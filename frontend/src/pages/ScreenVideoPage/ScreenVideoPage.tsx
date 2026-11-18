import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker, useNavigate, useParams } from '@tanstack/react-router'
import { useSession } from '../../auth/session'
import RenderProgress from '../../components/RenderProgress'
import type { Render } from '../../components/RenderProgress'
import UploadProgress from '../../components/UploadProgress'
import type { Upload } from '../../components/UploadProgress'
import { api, ApiError, errorMessage } from '../../lib/api'
import { declaredTypeError, fileTypeLabel } from '../../lib/file'
import { formatByteSize } from '../../lib/format'
import { useNotify } from '../../lib/useNotify'
import { formatTimecode } from '../VideoEditorPage/edit'
import { ExportError } from '../VideoEditorPage/exportError'
import { findFile } from '../VideoEditorPage/findFile'
import { defaultFits, screenCanvas, screenFileName, screenRegions } from './screenLayout'
import type { Fit, RegionId } from './screenLayout'
import { useScreenPlayback } from './useScreenPlayback'
import './ScreenVideoPage.css'

type Conversion = { source: Blob, name: string, fits: Record<RegionId, Fit> }
type Job =
  | { step: 'render', render: Render, conversion: Conversion }
  | { step: 'upload', upload: Upload, conversion: Conversion }

const canEncode = typeof VideoEncoder === 'function'

export default function ScreenVideoPage() {
  const { fileId } = useParams({ strict: false })
  // A different route source starts a fresh workspace, including playback and pending downloads.
  return <ScreenVideoWorkspace key={fileId ?? 'local'} fileId={fileId} />
}

function ScreenVideoWorkspace({ fileId }: { fileId?: string }) {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const notify = useNotify()
  const navigate = useNavigate()
  const ids = useId()
  const picker = useRef<HTMLInputElement>(null)
  const jobAbort = useRef<AbortController | null>(null)
  const [local, setLocal] = useState<File>()
  const [selectionError, setSelectionError] = useState<string>()
  const [fits, setFits] = useState(defaultFits)
  const [job, setJob] = useState<Job | null>(null)

  const meta = useQuery({
    queryKey: ['file', revision, fileId],
    queryFn: ({ signal }) => {
      if (!fileId) throw new ApiError(404, 'Fișierul nu a fost găsit')
      return findFile(queryClient, revision, fileId, signal)
    },
    enabled: !!fileId && !local,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const file = meta.data
  const isMp4 = file?.mimeType === 'video/mp4'
  const content = useQuery({
    queryKey: ['file-content', revision, fileId],
    queryFn: ({ signal }) => {
      if (!file) throw new ApiError(404, 'Fișierul nu a fost găsit')
      return api.downloadFile(file, signal)
    },
    enabled: isMp4 && !local,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const source = local ?? (isMp4 ? content.data : undefined)
  const name = local?.name ?? file?.originalName
  const mimeType = local ? local.type || 'video/mp4' : file?.mimeType
  const size = local?.size ?? file?.size
  const playback = useScreenPlayback(source, fits)
  const { videoRef, canvasRef } = playback
  const busy = job !== null && (job.step === 'render' ? job.render.phase === 'rendering' : job.upload.phase !== 'failed')
  const currentTime = Math.min(playback.time, playback.duration)

  useBlocker({
    shouldBlockFn: () => !window.confirm('Conversia sau încărcarea este în curs. Părăsești pagina și o anulezi?'),
    enableBeforeUnload: busy,
    disabled: !busy,
  })
  useEffect(() => () => {
    jobAbort.current?.abort()
    jobAbort.current = null
  }, [])

  function chooseFile(selected: File | undefined) {
    if (!selected || jobAbort.current) return
    const error = declaredTypeError(selected)
      ?? ((selected.type ? selected.type !== 'video/mp4' : !/\.mp4$/i.test(selected.name)) ? 'Alege un videoclip MP4.' : undefined)
    setSelectionError(error)
    if (error) return
    setLocal(selected)
    setJob(null)
  }

  function isCurrent(controller: AbortController) {
    return jobAbort.current === controller && revision === useSession.getState().revision
  }

  async function startExport(conversion: Conversion) {
    if (jobAbort.current || !canEncode) return
    playback.pause()
    const controller = new AbortController()
    jobAbort.current = controller
    setJob({ step: 'render', render: { phase: 'rendering', progress: 0 }, conversion })
    let rendered: File
    try {
      const { renderScreen } = await import('./renderScreen')
      controller.signal.throwIfAborted()
      const blob = await renderScreen(conversion.source, conversion.fits, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!isCurrent(controller) || controller.signal.aborted) return
          setJob((current) => current?.step === 'render' && current.conversion === conversion && current.render.phase === 'rendering'
            ? { ...current, render: { phase: 'rendering', progress } } : current)
        },
      })
      controller.signal.throwIfAborted()
      if (!isCurrent(controller)) return
      rendered = new File([blob], conversion.name, { type: 'video/mp4' })
    } catch (error) {
      if (!isCurrent(controller)) return
      jobAbort.current = null
      if (controller.signal.aborted) {
        setJob(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: 'Conversia a fost anulată. Sursa și încadrarea sunt păstrate.' })
      } else {
        setJob({ step: 'render', render: { phase: 'failed', error: error instanceof ExportError ? error.message : errorMessage(error) }, conversion })
      }
      return
    }
    await uploadExport(rendered, conversion, controller)
  }

  async function uploadExport(rendered: File, conversion: Conversion, controller = new AbortController()) {
    if (jobAbort.current && jobAbort.current !== controller) return
    jobAbort.current = controller
    setJob({ step: 'upload', upload: { file: rendered, phase: 'sending', sent: 0 }, conversion })
    const sending = (current: Job | null) => isCurrent(controller) && !controller.signal.aborted
      && current?.step === 'upload' && current.upload.file === rendered && current.upload.phase === 'sending'
    try {
      const stored = await api.uploadFile(rendered, {
        signal: controller.signal,
        onProgress: (sent) => setJob((current) => sending(current) ? { step: 'upload', upload: { file: rendered, phase: 'sending', sent }, conversion } : current),
        onSent: () => setJob((current) => sending(current) ? { step: 'upload', upload: { file: rendered, phase: 'saving', sent: rendered.size }, conversion } : current),
      })
      controller.signal.throwIfAborted()
      if (!isCurrent(controller)) return
      setJob(null)
      notify({
        variant: 'success', message: `Salvat ${stored.originalName} (${formatByteSize(stored.size)}) în Fișiere.`,
        action: { label: 'Vezi fișierele', onClick: () => { void navigate({ to: '/files' }) } },
      })
    } catch (error) {
      if (!isCurrent(controller)) return
      if (controller.signal.aborted) {
        setJob(null)
        if (controller.signal.reason === 'user') notify({ variant: 'info', message: 'Încărcarea a fost anulată. Sursa și încadrarea sunt păstrate.' })
      } else {
        const retryable = !(error instanceof ApiError) || error.status === 0 || error.status === 409 || error.status >= 500
        setJob({ step: 'upload', upload: { file: rendered, phase: 'failed', error: errorMessage(error), retryable }, conversion })
      }
    } finally {
      if (jobAbort.current === controller) jobAbort.current = null
      // Even a canceled request may have been stored before its response was lost.
      void queryClient.invalidateQueries({ queryKey: ['files', revision] })
    }
  }

  const sourceError = !local && fileId && (meta.isError || content.isError)
  const notFound = meta.error instanceof ApiError && meta.error.status === 404
  const exportNote = !canEncode
    ? 'Acest browser nu poate converti videoclipuri. Folosește o versiune recentă de Chrome, Edge sau Safari.'
    : !playback.ready ? 'Alege un MP4 și așteaptă încărcarea previzualizării pentru a-l converti.'
    : 'Încadrarea aleasă pentru fiecare regiune se aplică întregului videoclip. Sunetul este păstrat.'

  return (
    <section className="screen-video">
      <header>
        <div className="page-heading">
          <h1>Video pentru ecranul camionului</h1>
          <button type="button" className="primary-button" disabled={!playback.ready || busy || !canEncode}
            aria-describedby={busy ? `${ids}-job` : `${ids}-export-note`}
            onClick={() => { if (source && name) void startExport({ source, name: screenFileName(name), fits: { ...fits } }) }}>
            Convertește și salvează în Fișiere
          </button>
        </div>
        <p className="page-description">Un MP4 de <span className="num">2304 × 512</span> cu trei copii ale aceluiași videoclip, salvat ca fișier nou în Fișiere. Originalul rămâne neschimbat.</p>
      </header>
      <p className="screen-note" id={`${ids}-export-note`}>{exportNote}</p>
      {job?.step === 'render' && (
        <RenderProgress id={`${ids}-job`} name={job.conversion.name} render={job.render}
          onCancel={() => jobAbort.current?.abort('user')}
          onRetry={() => void startExport(job.conversion)} onDismiss={() => setJob(null)} />
      )}
      {job?.step === 'upload' && (
        <UploadProgress id={`${ids}-job`} upload={job.upload}
          onCancel={() => jobAbort.current?.abort('user')}
          onRetry={() => void uploadExport(job.upload.file, job.conversion)} onDismiss={() => setJob(null)} />
      )}

      <div className="screen-source">
        <div className="screen-source-row">
          <button type="button" disabled={busy} onClick={() => picker.current?.click()}
            aria-describedby={selectionError ? `${ids}-selection-error` : undefined}>Alege un MP4 din calculator</button>
          <input ref={picker} type="file" accept="video/mp4" hidden disabled={busy} onChange={(event) => {
            chooseFile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }} />
          {name && <p className="screen-source-details"><strong>{name}</strong><span>{fileTypeLabel(mimeType ?? 'video/mp4')} · <span className="num">{formatByteSize(size ?? 0)}</span></span></p>}
        </div>
        <p className="screen-note">Videoclipurile deja salvate în <Link to="/files">Fișiere</Link> se deschid prin butonul „Ecran camion”. Doar rezultatul conversiei este încărcat.</p>
        {selectionError && <p className="field-error" role="alert" id={`${ids}-selection-error`}>{selectionError}</p>}
        {sourceError && <div className="request-error" role="alert">
          <p>{notFound ? 'Fișierul nu mai apare în Fișiere sau linkul este incorect.' : `Videoclipul nu a putut fi încărcat. ${errorMessage(meta.error ?? content.error)}`}</p>
          {!notFound && <button type="button" disabled={meta.isFetching || content.isFetching}
            onClick={() => { void (meta.isError ? meta.refetch() : content.refetch()) }}>Reîncearcă</button>}
        </div>}
        {!local && file && !isMp4 && <p className="request-error" role="alert">Pot fi convertite doar videoclipuri MP4.</p>}
      </div>

      <section className="screen-preview" aria-labelledby={`${ids}-preview-title`}>
        <div className="screen-section-heading">
          <h2 id={`${ids}-preview-title`}>Previzualizare</h2>
          <span className="num">2304 × 512 px</span>
        </div>
        <div className="screen-canvas-frame">
          <canvas ref={canvasRef} width={screenCanvas.width} height={screenCanvas.height}
            role="img" aria-label="Previzualizarea celor trei copii ale videoclipului, cu spații negre între regiuni" />
          {screenRegions.map((region) => <div key={region.id} className="screen-region-outline" aria-hidden="true" style={{
            left: `${region.x / screenCanvas.width * 100}%`, top: `${region.y / screenCanvas.height * 100}%`,
            width: `${region.width / screenCanvas.width * 100}%`, height: `${region.height / screenCanvas.height * 100}%`,
          }}><span>{region.label}</span></div>)}
        </div>
        <video ref={videoRef} hidden playsInline preload="auto" />
        {playback.unplayable ? <p className="request-error" role="alert">Acest browser nu poate reda videoclipul. Alege un alt MP4 sau folosește o versiune recentă de Chrome, Edge ori Safari.</p>
          : !playback.ready && !sourceError && (local || !file || isMp4) ? <p className="screen-note" role="status">
            {source || fileId ? 'Se încarcă videoclipul…' : 'Alege un MP4 pentru a vedea încadrarea în cele trei regiuni.'}
          </p> : null}
        <input className="screen-scrubber" type="range" min={0} max={playback.duration} step={0.1} value={currentTime}
          disabled={!playback.ready || busy} aria-label="Poziția de redare"
          aria-valuetext={`${formatTimecode(currentTime)} din ${formatTimecode(playback.duration)}`}
          onChange={(event) => playback.seek(Number(event.currentTarget.value))} />
        <div className="screen-playback">
          <button type="button" className="ghost-button" disabled={!playback.ready || busy}
            onClick={playback.playing ? playback.pause : playback.play}>{playback.playing ? 'Pauză' : 'Redă'}</button>
          <p className="num">{formatTimecode(currentTime)}<span className="unit"> din {formatTimecode(playback.duration)}</span></p>
        </div>
      </section>

      <div className="screen-regions">
        {screenRegions.map((region) => <fieldset key={region.id} disabled={busy}>
          <legend>{region.label}</legend>
          <p className="screen-region-size num">{region.width} × {region.height} px · x {region.x}, y {region.y}</p>
          <label><input type="radio" name={`${ids}-${region.id}`} value="cover" checked={fits[region.id] === 'cover'}
            onChange={() => setFits((current) => ({ ...current, [region.id]: 'cover' }))} />Decupează pentru umplere</label>
          <label><input type="radio" name={`${ids}-${region.id}`} value="contain" checked={fits[region.id] === 'contain'}
            onChange={() => setFits((current) => ({ ...current, [region.id]: 'contain' }))} />Încadrează cu bandă neagră</label>
        </fieldset>)}
      </div>
      <p className="screen-layout-note">Configurația provine din fotografiile ViPlex și trebuie confirmată pe camion, inclusiv corespondența dintre regiuni și laturile fizice. Ieșirea HDMI la <span className="num">2304 × 512</span> nu a fost testată.</p>
    </section>
  )
}
