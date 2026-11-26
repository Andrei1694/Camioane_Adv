import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useIsFocused } from 'expo-router'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useQueryClient } from '@tanstack/react-query'
import { screenMedia } from '../../../modules/screen-video/index'
import { useSession } from '../../auth/session'
import { api, ApiError } from '../../lib/api'
import type { StoredFile } from '../../lib/file'
import { defaultFits, placement, regionsFor, sameResolution, screenFileName } from './screenLayout'
import type { Fit, RegionId, Resolution } from './screenLayout'
import { deleteVideo, pickMp4 } from './videoFiles'
import { renderVideo } from './renderVideo'
import { useResolutions } from './useResolutions'
import { abortError, mediaError } from './types'
import type { Composition, LocalVideo, MediaInfo } from './types'

let nextWorkspace = 0
type Phase = '' | 'Alege un MP4…' | 'Se descarcă…' | 'Se pregătește…' | 'Se convertește…' | 'Se încarcă…' | 'Se salvează…'

export function useScreenEditor(fileId?: string) {
  const revision = useSession((state) => state.revision)
  const preview = useSession((state) => state.preview)
  const focused = useIsFocused()
  const queryClient = useQueryClient()
  const [fits, setFits] = useState({ ...defaultFits })
  const [source, setSource] = useState<LocalVideo>()
  const [info, setInfo] = useState<MediaInfo>()
  const [previewId, setPreviewId] = useState('')
  const [result, setResult] = useState<LocalVideo>()
  const [saved, setSaved] = useState<StoredFile>()
  const [phase, setPhase] = useState<Phase>('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [retry, setRetry] = useState<(() => void) | null>(null)
  const [w] = useState(() => ({ id: `screen-${Date.now()}-${++nextWorkspace}`, alive: true, files: new Set<LocalVideo>(),
    sessions: new Set<string>(), activePreview: '', controller: null as AbortController | null, task: null as Promise<void> | null }))
  const resolutions = useResolutions()
  const resolution = resolutions.selected
  const regions = regionsFor(resolution)
  const composition: Composition | undefined = info ? { ...resolution, sourceWidth: info.width, sourceHeight: info.height,
    regions: regions.map((region) => placement(info.width, info.height, region, fits[region.id])) } : undefined
  const compositionJson = composition ? JSON.stringify(composition) : ''

  useEffect(() => {
    w.alive = true
    const subscription = screenMedia?.addListener('onPlayback', (event) => {
      if (!w.alive || event.id !== w.activePreview) return
      setTime(event.time)
      setPlaying(event.playing)
      if (event.error) setError(event.error)
    })
    return () => {
      w.alive = false
      w.controller?.abort()
      subscription?.remove()
      // Release open previews now (including a pending open), then wait for export/transfer
      // cancellation before deleting any file a native reader could still be using.
      const released = Promise.all([...w.sessions].map((id) => screenMedia?.release(id)))
      void Promise.all([released, w.task]).then(async () => {
        for (const file of w.files) await deleteVideo(file).catch(() => {})
        w.files.clear()
      }).catch(() => { /* Retain cache copies if native release cannot be confirmed. */ })
    }
  }, [w])

  useEffect(() => {
    if (!previewId || !compositionJson) return
    void screenMedia?.layout(previewId, compositionJson).catch((failure: unknown) => { if (w.alive) setError(mediaError(failure)) })
  }, [previewId, compositionJson, w])

  useEffect(() => {
    if (!focused) void screenMedia?.pause(w.activePreview)
  }, [focused, w])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return
      void screenMedia?.pause(w.activePreview)
      // Opening the system picker can background Android; that operation isn't an export.
      if (phase !== 'Alege un MP4…') w.controller?.abort()
    })
    return () => subscription.remove()
  }, [phase, w])

  useEffect(() => {
    if (phase !== 'Se convertește…') return
    const tag = `${w.id}-convert`
    let ended = false
    void activateKeepAwakeAsync(tag).then(() => { if (ended) void deactivateKeepAwake(tag).catch(() => {}) }).catch(() => {
      if (!ended && w.alive) setNotice('Păstrează ecranul aprins până la finalul conversiei.')
    })
    return () => { ended = true; void deactivateKeepAwake(tag).catch(() => {}) }
  }, [phase, w])

  function updatePhase(value: Phase) { if (w.alive) { setPhase(value); setProgress(0) } }
  function run(action: (signal: AbortSignal) => Promise<void>, retryAction?: () => void) {
    if (w.controller || !w.alive) return
    const controller = new AbortController()
    w.controller = controller
    setError('')
    setNotice('')
    setRetry(null)
    w.task = (async () => {
      try { await action(controller.signal) } catch (failure) {
        if (!w.alive) return
        if (controller.signal.aborted) setNotice('Operația a fost anulată. Sursa și încadrarea sunt păstrate.')
        else {
          setError(mediaError(failure))
          if (retryAction && (!(failure instanceof ApiError) || failure.status === 0 || failure.status === 409 || failure.status >= 500)) setRetry(() => retryAction)
        }
      } finally {
        if (w.controller === controller) w.controller = null
        if (w.alive) setPhase('')
      }
    })()
  }

  async function open(video: LocalVideo, signal: AbortSignal) {
    w.files.add(video)
    if (signal.aborted || !w.alive) throw abortError()
    if (!screenMedia) throw new Error('Instalează o versiune nouă a aplicației pentru previzualizare și conversie. Expo Go nu include convertorul.')
    updatePhase('Se pregătește…')
    const id = `${w.id}-preview-${w.sessions.size}`
    w.sessions.add(id)
    const cancel = () => { void screenMedia?.release(id).catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      const metadata = await screenMedia.open(id, video.uri)
      signal.throwIfAborted()
      if (!w.alive) throw abortError()
      const previous = w.activePreview
      if (previous) await screenMedia.release(previous)
      signal.throwIfAborted()
      w.activePreview = id
      setSource(video)
      setInfo(metadata)
      setPreviewId(id)
      setResult(undefined)
      setSaved(undefined)
      setTime(0)
      setPlaying(false)
    } catch (failure) {
      await screenMedia.release(id)
      throw failure
    } finally { signal.removeEventListener('abort', cancel) }
  }

  function choose() {
    run(async (signal) => {
      await screenMedia?.pause(w.activePreview)
      updatePhase('Alege un MP4…')
      const video = await pickMp4()
      if (video) await open(video, signal)
    })
  }

  async function download(file: StoredFile, signal: AbortSignal) {
    if (file.mimeType !== 'video/mp4') throw new Error('Pot fi convertite doar videoclipuri MP4.')
    updatePhase('Se descarcă…')
    const video = await api.downloadFile(file, { signal, onProgress: (value) => { if (w.alive) setProgress(value) } })
    await open(video, signal)
  }
  function chooseStored(file: StoredFile) { run((signal) => download(file, signal), () => chooseStored(file)) }

  async function upload(video: LocalVideo, signal: AbortSignal) {
    updatePhase('Se încarcă…')
    try {
      const stored = await api.uploadFile(video, { signal, onProgress: (value) => {
        if (!w.alive || signal.aborted) return
        setProgress(value)
        if (value >= 1) setPhase('Se salvează…')
      } })
      if (w.alive) { setSaved(stored); setNotice(`Salvat în Fișiere: ${stored.originalName}`) }
    } finally { void queryClient.invalidateQueries({ queryKey: ['files', revision] }) }
  }
  function save(video = result) {
    if (video && !preview) run((signal) => upload(video, signal), () => save(video))
  }
  function convert() {
    if (!source || !composition) return
    let rendered: LocalVideo | undefined
    run(async (signal) => {
      await screenMedia?.pause(w.activePreview)
      updatePhase('Se convertește…')
      rendered = await renderVideo(`${w.id}-job-${Date.now()}`, source, screenFileName(source.name, resolution), composition, signal,
        (value) => { if (w.alive && !signal.aborted) setProgress(value) })
      w.files.add(rendered)
      signal.throwIfAborted()
      if (!w.alive) throw abortError()
      setResult(rendered)
      setSaved(undefined)
      if (!preview) await upload(rendered, signal)
      else setNotice('Conversia este gata. Previzualizarea locală nu poate salva pe server; poți reda rezultatul pe HDMI.')
    }, () => { if (rendered) save(rendered); else convert() })
  }

  useEffect(() => {
    if (!fileId || preview) return
    function load() {
      run(async (signal) => {
        updatePhase('Se descarcă…')
        if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(fileId!)) throw new ApiError(404, 'Fișierul nu a fost găsit.')
        for (let offset = 0; ; offset += 50) {
          const page = await queryClient.fetchQuery({ queryKey: ['files', revision, offset], queryFn: () => api.files(offset, signal) })
          const file = page.files.find((candidate) => candidate.id === fileId)
          if (file) { await download(file, signal); return }
          if (offset + 50 >= page.total || !page.files.length) throw new ApiError(404, 'Fișierul nu mai apare în Fișiere sau nu ai acces la el.')
        }
      }, load)
    }
    load()
    // A route-source change remounts the workspace; load its initial source once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function control(action: 'play' | 'pause' | 'seek', seconds = 0) {
    if (!screenMedia || !previewId || phase) return
    const operation = action === 'seek' ? screenMedia.seek(previewId, seconds) : screenMedia[action](previewId)
    void operation.catch((failure: unknown) => { if (w.alive) setError(mediaError(failure)) })
  }
  function discardResult() {
    setResult(undefined)
    setSaved(undefined)
    setRetry(null)
    setNotice('')
  }
  function fit(region: RegionId, value: Fit) {
    setFits((current) => ({ ...current, [region]: value }))
    discardResult()
  }
  function resize(next: Resolution) {
    if (sameResolution(next, resolution)) return
    resolutions.select(next)
    discardResult()
  }
  function addResolution(next: Resolution) {
    const problem = resolutions.add(next)
    if (!problem) discardResult()
    return problem
  }
  function removeResolution(target: Resolution) {
    if (sameResolution(target, resolution)) discardResult()
    resolutions.remove(target)
  }
  async function preparePlayback() {
    w.controller?.abort()
    await w.task
    if (!w.alive) throw abortError()
    await screenMedia?.pause(w.activePreview)
  }
  return { fits, source, info, previewId, result, saved, phase, progress, error, notice, time, playing, preview,
    retry, choose, chooseStored, convert, save, control, fit, cancel: () => w.controller?.abort(),
    preparePlayback, available: !!screenMedia, resolution, regions, customResolutions: resolutions.custom,
    resolutionsReady: resolutions.ready, resolutionError: resolutions.error, resize, addResolution, removeResolution }
}
