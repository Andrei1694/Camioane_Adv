import { useRef } from 'react'
import { formatByteSize } from '../../../lib/format'
import type { usePlaylist } from '../usePlaylist'

export default function PlaylistPanel({ playlist, currentId, onEdit, onFiles }: {
  playlist: ReturnType<typeof usePlaylist>
  currentId?: string
  onEdit: () => void
  onFiles: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const disabled = playlist.busy || playlist.items === null
  return <div className="display-source-body">
    <p className="display-note">Playlistul se păstrează în acest browser, separat pentru contul tău, inclusiv după deconectare. Ștergerea datelor site-ului elimină și videoclipurile salvate.</p>
    <div className="display-actions">
      <button type="button" disabled={disabled} onClick={() => input.current?.click()}>Adaugă din calculator</button>
      <input ref={input} type="file" accept="video/mp4,.mp4" hidden multiple disabled={disabled} onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? [])
        event.currentTarget.value = ''
        if (!files.length) return
        onEdit()
        void playlist.addLocal(files)
      }} />
      <button type="button" disabled={disabled} onClick={onFiles}>Adaugă din Fișiere</button>
    </div>
    {playlist.operation && <div className="display-actions">
      <p role="status">{playlist.operation}</p>
      <button type="button" className="text-button" onClick={playlist.cancel}>Anulează</button>
    </div>}
    {playlist.error && <div className="request-error" role="alert">
      <p>{playlist.error}</p>
      {!playlist.items && <button type="button" disabled={playlist.busy} onClick={() => void playlist.retry()}>Reîncearcă</button>}
    </div>}
    {playlist.items?.length === 0 && <p className="empty-state">Playlistul este gol. Adaugă primul videoclip MP4.</p>}
    {!!playlist.items?.length && <ol className="display-playlist" aria-label="Ordinea videoclipurilor">
      {playlist.items.map((item, index) => <li key={item.id} aria-current={currentId === item.id ? 'true' : undefined}>
        <span className="display-item-number num" aria-hidden="true">{index + 1}</span>
        <div className="display-item-details">
          <strong>{item.name}</strong>
          <p className="display-note"><span className="num">{formatByteSize(item.size)}</span> · {item.source === 'device' ? 'Din calculator' : 'Din Fișiere'}{currentId === item.id ? ' · Curent' : ''}</p>
        </div>
        <div className="display-actions">
          <button type="button" className="ghost-button" disabled={disabled || index === 0} onClick={() => { onEdit(); void playlist.move(index, index - 1) }}>
            ↑ Sus<span className="sr-only"> {item.name}</span>
          </button>
          <button type="button" className="ghost-button" disabled={disabled || index === playlist.items!.length - 1} onClick={() => { onEdit(); void playlist.move(index, index + 1) }}>
            ↓ Jos<span className="sr-only"> {item.name}</span>
          </button>
          <button type="button" className="text-button danger" disabled={disabled} onClick={() => { onEdit(); void playlist.remove(item.id) }}>
            Elimină<span className="sr-only"> {item.name}</span>
          </button>
        </div>
      </li>)}
    </ol>}
    <p className="display-note">După orice modificare a listei, apasă Redă din nou.</p>
  </div>
}
