import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../../../auth/session'
import { api, errorMessage } from '../../../lib/api'
import { fileTypeLabel } from '../../../lib/file'
import type { StoredFile } from '../../../lib/file'
import { formatByteSize } from '../../../lib/format'
import Pagination from '../../../components/Pagination'

export default function FilePickerDialog({ selectedIds, onSelect, onClose }: {
  selectedIds: ReadonlySet<string>, onSelect: (file: StoredFile) => void, onClose: () => void
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const revision = useSession((state) => state.revision)
  const [offset, setOffset] = useState(0)
  const files = useQuery({
    queryKey: ['files', revision, offset],
    queryFn: ({ signal }) => api.files({ limit: 50, offset }, signal),
  })
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  return <dialog ref={dialog} className="dialog display-file-picker" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onClose={onClose} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
    }}>
    <div className="dialog-head">
      <div><h2 id={`${id}-title`}>Alege din Fișiere</h2><p className="dialog-sub" id={`${id}-description`}>Se pot reda doar fișiere MP4. Conturile fără acces de administrator văd doar fișierele proprii.</p></div>
      <button type="button" className="icon-button" aria-label="Închide lista de fișiere" onClick={() => dialog.current?.close()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </div>
    {files.isPending && <p role="status">Se încarcă fișierele…</p>}
    {files.isError && <div className="request-error" role="alert"><p>{errorMessage(files.error)}</p><button type="button" disabled={files.isFetching} onClick={() => void files.refetch()}>Reîncearcă</button></div>}
    {files.data && <>
      {files.data.files.length === 0 && <p className="empty-state">Nu există fișiere pe această pagină.</p>}
      <ul className="display-picker-list">
        {files.data.files.map((file) => <li key={file.id}>
          <div className="display-item-details"><strong>{file.originalName}</strong><p className="display-note">{fileTypeLabel(file.mimeType)} · <span className="num">{formatByteSize(file.size)}</span>{selectedIds.has(file.id) ? ' · Selectat' : ''}</p></div>
          <button type="button" disabled={file.mimeType !== 'video/mp4'} onClick={() => onSelect(file)}>Alege<span className="sr-only"> {file.originalName}</span></button>
        </li>)}
      </ul>
      <Pagination offset={offset} pageSize={50} total={files.data.total} label="Pagini cu fișiere" onPage={setOffset} />
    </>}
  </dialog>
}
