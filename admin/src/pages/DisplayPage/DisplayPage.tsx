import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useParams } from '@tanstack/react-router'
import { useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import type { StoredFile } from '../../lib/file'
import { findFile } from '../../lib/findFile'
import { usePlacement } from './usePlacement'
import { mp4Error, usePlaylist } from './usePlaylist'
import { useOutputWindow } from './useOutputWindow'
import { useDisplayPlayback } from './useDisplayPlayback'
import FilePickerDialog from './components/FilePickerDialog'
import OutputPanel from './components/OutputPanel'
import OutputSurface from './components/OutputSurface'
import PlacementPanel from './components/PlacementPanel'
import PlaylistPanel from './components/PlaylistPanel'
import TestSource from './components/TestSource'
import TransportControls from './components/TransportControls'
import './DisplayPage.css'

export default function DisplayPage() {
  const { fileId } = useParams({ strict: false })
  return <DisplayWorkspace key={fileId ?? 'local'} fileId={fileId} />
}

function DisplayWorkspace({ fileId }: { fileId?: string }) {
  const ids = useId()
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const [source, setSource] = useState<'test' | 'playlist'>('test')
  const [serverId, setServerId] = useState(fileId)
  const [local, setLocal] = useState<File>()
  const [selectionError, setSelectionError] = useState('')
  const [picker, setPicker] = useState<'test' | 'playlist' | null>(null)
  const output = useOutputWindow()
  const placement = usePlacement()
  const playlist = usePlaylist()
  const playback = useDisplayPlayback(output.output)
  const { prepare } = playback

  const meta = useQuery({
    queryKey: ['file', revision, serverId],
    queryFn: ({ signal }) => {
      if (!serverId) throw new ApiError(404, 'Fișierul nu a fost găsit')
      return findFile(queryClient, revision, serverId, signal)
    },
    enabled: !!serverId && !local && source === 'test',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const file = meta.data
  const isMp4 = file?.mimeType === 'video/mp4'
  const content = useQuery({
    queryKey: ['file-content', revision, serverId],
    queryFn: ({ signal }) => {
      if (!file) throw new ApiError(404, 'Fișierul nu a fost găsit')
      return api.downloadFile(file, signal)
    },
    enabled: isMp4 && !local && source === 'test',
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const blob = local ?? (isMp4 ? content.data : undefined)
  const name = local?.name ?? file?.originalName
  const items = useMemo(() => {
    if (source === 'playlist') return playlist.items ?? []
    return blob && name ? [{ id: local ? 'local-test' : serverId!, name, blob }] : []
  }, [source, playlist.items, blob, name, local, serverId])

  useEffect(() => { prepare(items) }, [items, prepare])

  useBlocker({
    shouldBlockFn: () => !window.confirm('O operație de playlist este în curs. Părăsești pagina și o anulezi?'),
    enableBeforeUnload: playlist.busy,
    disabled: !playlist.busy,
  })

  function chooseLocal(selected?: File) {
    if (!selected) return
    const error = mp4Error(selected)
    setSelectionError(error ?? '')
    if (error) return
    playback.stop()
    setLocal(selected)
    setServerId(undefined)
  }

  function chooseServer(selected: StoredFile) {
    const target = picker
    setPicker(null)
    playback.pause()
    if (target === 'playlist') { void playlist.addServer(selected); return }
    playback.stop()
    queryClient.setQueryData(['file', revision, selected.id], selected)
    setSelectionError('')
    setLocal(undefined)
    setServerId(selected.id)
  }

  function switchSource(value: 'test' | 'playlist') {
    playback.stop()
    setSource(value)
  }

  const sourceError = !local && serverId && (meta.isError || content.isError)
    ? errorMessage(meta.error ?? content.error) : undefined
  const selectedIds = new Set(picker === 'playlist'
    ? playlist.items?.flatMap((item) => item.fileId ? [item.fileId] : [])
    : serverId ? [serverId] : [])

  return <section className="display-page">
    <header><h1>Redare pe ecranul camionului</h1><p className="page-description">Redă un MP4 sau un playlist pe ecranul conectat la calculator, cu comenzile în această pagină.</p></header>
    <OutputPanel output={output} />
    <section className="display-panel" aria-labelledby={`${ids}-source`}>
      <h2 id={`${ids}-source`}>Sursă</h2>
      <fieldset className="display-source-choice" disabled={playlist.busy}>
        <legend className="sr-only">Sursa de redare</legend>
        <label><input type="radio" name={`${ids}-source-choice`} value="test" checked={source === 'test'} onChange={() => switchSource('test')} /> Videoclip de test</label>
        <label><input type="radio" name={`${ids}-source-choice`} value="playlist" checked={source === 'playlist'} onChange={() => switchSource('playlist')} /> Playlist</label>
      </fieldset>
      {source === 'test' ? <>
        <TestSource name={name} size={local?.size ?? file?.size}
          loading={!local && !!serverId && (meta.isFetching || content.isFetching)} error={sourceError}
          onLocal={chooseLocal} onFiles={() => setPicker('test')}
          onRetry={() => { void (meta.isError ? meta.refetch() : content.refetch()) }} />
        {selectionError && <p className="field-error" role="alert">{selectionError}</p>}
        {!local && file && !isMp4 && <p className="request-error" role="alert">Pot fi redate doar videoclipuri MP4.</p>}
      </> : <PlaylistPanel playlist={playlist} currentId={playback.items[playback.index]?.id}
        onEdit={playback.pause} onFiles={() => setPicker('playlist')} />}
    </section>
    <TransportControls playback={playback} playlist={source === 'playlist'} open={!!output.output} busy={source === 'playlist' && playlist.busy} />
    <PlacementPanel placement={placement.placement} frame={output.frame} video={playback.video} pattern={playback.pattern}
      open={!!output.output} error={placement.error} onChange={placement.update} onPattern={playback.setPattern} />
    {picker && <FilePickerDialog selectedIds={selectedIds} onSelect={chooseServer} onClose={() => setPicker(null)} />}
    {output.output && <OutputSurface key="output" output={output.output} frame={output.frame} placement={placement.placement} playback={playback} />}
  </section>
}
