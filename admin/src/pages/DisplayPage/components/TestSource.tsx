import { useRef } from 'react'
import { formatByteSize } from '../../../lib/format'

export default function TestSource({ name, size, loading, error, onLocal, onFiles, onRetry }: {
  name?: string
  size?: number
  loading: boolean
  error?: string
  onLocal: (file?: File) => void
  onFiles: () => void
  onRetry: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return <div className="display-source-body">
    <div className="display-actions">
      <button type="button" onClick={() => input.current?.click()}>Alege un MP4 din calculator</button>
      <input ref={input} type="file" accept="video/mp4,.mp4" hidden onChange={(event) => {
        onLocal(event.currentTarget.files?.[0])
        event.currentTarget.value = ''
      }} />
      <button type="button" onClick={onFiles}>Alege din Fișiere</button>
    </div>
    {name ? <p className="display-file-details"><strong>{name}</strong><span className="num">{formatByteSize(size ?? 0)}</span></p>
      : <p className="display-note">Alege videoclipul pe care vrei să-l redai în buclă, fără sunet.</p>}
    {loading && <p role="status">Se descarcă videoclipul…</p>}
    {error && <div className="request-error" role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={onRetry}>Reîncearcă</button></div>}
    <p className="display-note">Videoclipul de test nu se salvează în browser. Videoclipurile demonstrative se aleg din calculator sau din Fișiere.</p>
  </div>
}
