import { useEffect, useId, useReducer, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useBlocker, useNavigate } from '@tanstack/react-router'
import type { TimelineState } from '@xzdarcy/react-timeline-editor'
import { useSession } from '../../auth/session'
import UploadProgress from '../../components/UploadProgress'
import type { Upload } from '../../components/UploadProgress'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useNotify } from '../../lib/useNotify'
import { fileKind, fileTypeLabel } from '../../lib/file'
import { formatByteSize } from '../../lib/format'
import EditTimeline from './components/EditTimeline'
import RenderProgress from './components/RenderProgress'
import type { Render } from './components/RenderProgress'
import SegmentList from './components/SegmentList'
import {
  canSplit, dropAt, emptyHistory, formatTimecode, historyReducer, initialSegments, isUnchanged, moveBy, remove, resize, split,
  totalLength, trim,
} from './edit'
import type { Segment } from './edit'
import { ExportError } from './exportError'
import { findFile } from './findFile'
import { usePlayback } from './usePlayback'
import { fittingZoom, zoomLevels } from './zoom'
import './VideoEditorPage.css'

const route = getRouteApi('/files/$fileId/edit')

// An export renders the edit, then uploads the result; each step keeps the edit that produced it.
type Job =
  | { step: 'render', render: Render, edit: Segment[] }
  | { step: 'upload', upload: Upload, edit: Segment[] }

const canEncode = typeof VideoEncoder === 'function'

function editedName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, '') || originalName
  return `${base} (editat).mp4`
}

export default function VideoEditorPage() {
  const { fileId } = route.useParams()
  const revision = useSession((state) => state.revision)
  const notify = useNotify()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const ids = useId()
  const page = useRef<HTMLElement>(null)
  const timelineRef = useRef<TimelineState>(null)
  const jobAbort = useRef<AbortController | null>(null)

  const meta = useQuery({
    queryKey: ['file', revision, fileId],
    queryFn: ({ signal }) => findFile(queryClient, revision, fileId, signal),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const file = meta.data
  const isVideo = file !== undefined && fileKind(file.mimeType) === 'video'
  // The API has no range playback, so the editor loads the whole file once, like the preview.
  const content = useQuery({
    queryKey: ['file-content', revision, fileId],
    queryFn: ({ signal }) => {
      if (!file) throw new ApiError(404, 'Fișierul nu a fost găsit')
      return api.downloadFile(file, signal)
    },
    enabled: isVideo,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const [history, dispatch] = useReducer(historyReducer, emptyHistory)
  const segments = history.present
  const [duration, setDuration] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [zoom, setZoom] = useState<number>()
  const [unplayable, setUnplayable] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [savedEdit, setSavedEdit] = useState<Segment[] | null>(null)
  const playback = usePlayback(timelineRef, segments)
  const { videoRef } = playback

  const ready = segments.length > 0
  const total = totalLength(segments)
  const busy = job !== null && (job.step === 'render' ? job.render.phase === 'rendering' : job.upload.phase !== 'failed')
  const unchanged = ready && isUnchanged(segments, duration)
  const dirty = ready && !unchanged && segments !== savedEdit
  const selectedSegment = segments.find((segment) => segment.id === selected)
  const exportName = file ? editedName(file.originalName) : ''

  useBlocker({
    shouldBlockFn: () => !window.confirm(busy
      ? 'Exportul este în curs. Părăsești pagina și îl anulezi?'
      : "Această editare nu a fost exportată. Părăsești pagina și renunți la ea?"),
    enableBeforeUnload: busy || dirty,
    disabled: !busy && !dirty,
  })

  // Leaving the page cancels an export still in flight.
  useEffect(() => () => jobAbort.current?.abort(), [])

  // The video element reads the file through an object URL, which holds it in memory until revoked.
  useEffect(() => {
    const element = videoRef.current
    if (!content.data || !element) return
    const url = URL.createObjectURL(content.data)
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [content.data, unplayable, videoRef])

  function change(edit: (current: Segment[]) => Segment[] | undefined) {
    if (!busy) dispatch({ type: 'change', change: edit })
  }

  // Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z or Ctrl+Y redoes; text fields keep their own undo.
  useEffect(() => {
    if (busy) return
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      if (key === 'z') dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
      else if (key === 'y' && !event.shiftKey) dispatch({ type: 'redo' })
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy])

  async function startExport(edit: Segment[]) {
    if (!file || !content.data || busy) return
    playback.pause()
    const controller = new AbortController()
    jobAbort.current = controller
    setJob({ step: 'render', render: { phase: 'rendering', progress: 0 }, edit })
    let rendered: File
    try {
      const { renderEdit } = await import('./renderVideo')
      const blob = await renderEdit(content.data, edit, {
        signal: controller.signal,
        onProgress: (progress) => setJob((current) => current?.step === 'render' && current.edit === edit && current.render.phase === 'rendering'
          ? { ...current, render: { phase: 'rendering', progress } } : current),
      })
      rendered = new File([blob], exportName, { type: 'video/mp4' })
    } catch (error) {
      if (jobAbort.current === controller) jobAbort.current = null
      if (revision !== useSession.getState().revision) return
      if (controller.signal.aborted) {
        setJob(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: 'Exportul a fost anulat. Editarea este păstrată.' })
      } else {
        setJob({ step: 'render', render: { phase: 'failed', error: error instanceof ExportError ? error.message : errorMessage(error) }, edit })
      }
      return
    }
    await uploadExport(rendered, edit, controller)
  }

  async function uploadExport(rendered: File, edit: Segment[], controller = new AbortController()) {
    jobAbort.current = controller
    setJob({ step: 'upload', upload: { file: rendered, phase: 'sending', sent: 0 }, edit })
    const current = (job: Job | null) => job?.step === 'upload' && job.upload.file === rendered && job.upload.phase === 'sending'
    try {
      const stored = await api.uploadFile(rendered, {
        signal: controller.signal,
        onProgress: (sent) => setJob((job) => current(job) ? { step: 'upload', upload: { file: rendered, phase: 'sending', sent }, edit } : job),
        onSent: () => setJob((job) => current(job) ? { step: 'upload', upload: { file: rendered, phase: 'saving', sent: rendered.size }, edit } : job),
      })
      if (revision !== useSession.getState().revision) return
      setJob(null)
      setSavedEdit(edit)
      notify({
        variant: 'success', message: `Salvat ${stored.originalName} (${formatByteSize(stored.size)}) în Fișiere.`,
        action: { label: 'Vezi fișierele', onClick: () => { void navigate({ to: '/files' }) } },
      })
    } catch (error) {
      if (revision !== useSession.getState().revision) return
      if (controller.signal.aborted) {
        setJob(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: `Încărcarea fișierului ${rendered.name} a fost anulată. Editarea este păstrată.` })
      } else {
        // Content, size and format rejections fail the same way again; only transport and server failures are worth a retry.
        const retryable = !(error instanceof ApiError) || error.status === 0 || error.status === 409 || error.status >= 500
        setJob({ step: 'upload', upload: { file: rendered, phase: 'failed', error: errorMessage(error), retryable }, edit })
      }
    } finally {
      if (jobAbort.current === controller) jobAbort.current = null
      // A cancelled or failed request may still have been stored before its response was lost.
      void queryClient.invalidateQueries({ queryKey: ['files', revision] })
    }
  }

  const heading = (
    <header>
      <p className="editor-back"><Link to="/files">Fișiere</Link></p>
      <div className="page-heading">
        <h1>Editează videoclipul</h1>
        {isVideo && (
          <button type="button" className="primary-button" disabled={!ready || unchanged || busy || !canEncode}
            aria-describedby={busy ? `${ids}-job` : `${ids}-export-note`} onClick={() => void startExport(segments)}>
            Exportă în Fișiere
          </button>
        )}
      </div>
      <p className="page-description">
        {file ? <>
          <span className="editor-file-name">{file.originalName}</span>{' · '}{fileTypeLabel(file.mimeType)}{' · '}
          <span className="num">{formatByteSize(file.size)}</span>
        </> : meta.isError ? 'Fișierul nu este disponibil' : 'Se încarcă fișierul…'}
      </p>
    </header>
  )

  if (meta.isError || (file && !isVideo)) {
    const notFound = meta.error instanceof ApiError && meta.error.status === 404
    return (
      <section className="video-editor" ref={page}>
        {heading}
        {meta.isError ? (
          <div className="request-error" role="alert">
            <p>{notFound ? "Fișierul nu mai apare în Fișiere sau linkul este incorect." : `Acest fișier nu a putut fi încărcat. ${errorMessage(meta.error)}`}</p>
            {!notFound && <button type="button" disabled={meta.isFetching} onClick={() => void meta.refetch()}>{meta.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}</button>}
          </div>
        ) : <p className="empty-state editor-unsupported">Pot fi editate doar videoclipuri MP4. <Link to="/files">Înapoi la Fișiere</Link></p>}
      </section>
    )
  }

  const exportNote = !canEncode ? "Acest browser nu poate exporta videoclipuri. Folosește o versiune recentă de Chrome, Edge sau Safari."
    : unchanged ? 'Scurtează, împarte sau șterge o parte din videoclip pentru a exporta o copie editată.'
    : 'Exportul procesează editarea în acest browser și o salvează în Fișiere ca MP4 nou. Originalul rămâne neschimbat.'

  return (
    <section className="video-editor" ref={page}>
      {heading}
      <p className="editor-note" id={`${ids}-export-note`}>{exportNote}</p>
      {job?.step === 'render' && (
        <RenderProgress id={`${ids}-job`} name={exportName} render={job.render}
          onCancel={() => jobAbort.current?.abort('user')}
          onRetry={() => void startExport(job.edit)}
          onDismiss={() => setJob(null)} />
      )}
      {job?.step === 'upload' && (
        <UploadProgress id={`${ids}-job`} upload={job.upload}
          onCancel={() => jobAbort.current?.abort('user')}
          onRetry={() => void uploadExport(job.upload.file, job.edit)}
          onDismiss={() => setJob(null)} />
      )}

      <div className="editor-preview">
        {content.isError ? (
          <div className="request-error" role="alert">
            <p>Videoclipul nu a putut fi încărcat. {errorMessage(content.error)}</p>
            <button type="button" disabled={content.isFetching} onClick={() => void content.refetch()}>
              {content.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
            </button>
          </div>
        )
          : !content.data ? <p className="preview-note" role="status">{file ? `Se încarcă videoclipul (${formatByteSize(file.size)})…` : 'Se încarcă videoclipul…'}</p>
          : unplayable ? <p className="preview-note" role="alert">Acest browser nu poate reda videoclipul, deci acesta nu poate fi editat aici.</p>
          : <video ref={videoRef} playsInline preload="auto" aria-label={`Previzualizarea editării pentru ${file?.originalName ?? 'videoclip'}`}
            onError={() => setUnplayable(true)}
            onLoadedMetadata={(event) => {
              const length = event.currentTarget.duration
              if (!Number.isFinite(length) || length <= 0) {
                setUnplayable(true)
                return
              }
              setDuration(length)
              if (!ready) dispatch({ type: 'load', segments: initialSegments(length) })
              setZoom((current) => current ?? fittingZoom(length, page.current?.clientWidth ?? 960))
            }} />}
      </div>

      {/* The timeline's playhead is pointer-only; this slider moves it from the keyboard and on touch. */}
      <input className="editor-scrubber" type="range" min={0} max={total} step={0.1} value={Math.min(playback.time, total)}
        disabled={!ready} aria-label="Poziția de redare" aria-valuetext={`${formatTimecode(Math.min(playback.time, total))} din ${formatTimecode(total)}`}
        onChange={(event) => playback.seek(Number(event.currentTarget.value))} />

      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button type="button" className="ghost-button play-button" disabled={!ready} onClick={playback.playing ? playback.pause : playback.play}>
            {playback.playing ? 'Pauză' : 'Redă'}
          </button>
          <p className="timecode num">
            {formatTimecode(Math.min(playback.time, total))}<span className="unit"> din {formatTimecode(total)}</span>
          </p>
        </div>
        <div className="toolbar-group">
          <button type="button" className="ghost-button" disabled={!ready || busy || !canSplit(segments, playback.time)}
            aria-describedby={`${ids}-hint`} onClick={() => change((current) => split(current, playback.time))}>
            Împarte la poziția de redare
          </button>
          <button type="button" className="ghost-button" disabled={!selectedSegment || segments.length === 1 || busy}
            aria-describedby={`${ids}-hint`} onClick={() => {
              if (!selectedSegment) return
              change((current) => remove(current, selectedSegment.id))
              setSelected(undefined)
            }}>
            Șterge segmentul
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="ghost-button" disabled={history.past.length === 0 || busy} onClick={() => dispatch({ type: 'undo' })}>Anulează ultima acțiune</button>
          <button type="button" className="ghost-button" disabled={history.future.length === 0 || busy} onClick={() => dispatch({ type: 'redo' })}>Refă ultima acțiune</button>
          <button type="button" className="ghost-button" disabled={!ready || unchanged || busy} onClick={() => change(() => initialSegments(duration))}>Resetează</button>
        </div>
        <div className="toolbar-group zoom-group" role="group" aria-label="Mărirea cronologiei">
          <button type="button" className="ghost-button" disabled={!ready || zoom === zoomLevels.length - 1}
            onClick={() => setZoom((current) => Math.min((current ?? 0) + 1, zoomLevels.length - 1))}>
            Micșorează
          </button>
          <button type="button" className="ghost-button" disabled={!ready || zoom === 0}
            onClick={() => setZoom((current) => Math.max((current ?? 0) - 1, 0))}>
            Mărește
          </button>
        </div>
      </div>
      <p className="editor-note" id={`${ids}-hint`}>
        Fă clic pe un segment pentru a-l selecta. Trage marginile pentru a-l scurta sau mută-l pe rând pentru a-i schimba ordinea. Împărțirea taie segmentul la poziția de redare.
      </p>

      <EditTimeline timelineRef={timelineRef} segments={segments} duration={duration} selected={selectedSegment?.id}
        zoom={zoom ?? 3} locked={busy || !ready} playing={playback.playing} time={playback.time}
        onSelect={setSelected} onSeek={playback.seek}
        onResize={(id, length, dir) => change((current) => resize(current, id, length, dir, duration))}
        onDrop={(id, start, end) => change((current) => dropAt(current, id, start, end))} />

      {ready && (
        <SegmentList segments={segments} duration={duration} selected={selectedSegment?.id} locked={busy}
          onSelect={setSelected}
          onTrim={(id, edge, seconds) => change((current) => trim(current, id, edge, seconds, duration))}
          onMove={(id, step) => change((current) => moveBy(current, id, step))}
          onRemove={(id) => {
            change((current) => remove(current, id))
            if (id === selected) setSelected(undefined)
          }} />
      )}
    </section>
  )
}
