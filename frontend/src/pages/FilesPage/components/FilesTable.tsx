import { Link } from '@tanstack/react-router'
import { fileKind, fileTypeLabel } from '../../../lib/file'
import type { StoredFile } from '../../../lib/file'
import { byteSize, formatLocalDay, formatLocalTime, plural } from '../../../lib/format'
import OwnerLabel from '../../../components/OwnerLabel'
import Pagination from '../../../components/Pagination'

export type FilesView =
  | { status: 'loading' }
  | { status: 'error', error: string, retrying: boolean }
  | { status: 'ready', files: StoredFile[], total: number, refreshing: boolean }

export default function FilesTable({ view, offset, pageSize, downloading, deleting, onRetry, onPage, onPreview, onDownload, onDelete }: {
  view: FilesView
  offset: number
  pageSize: number
  downloading: ReadonlySet<string>
  deleting?: string
  onRetry: () => void
  onPage: (offset: number) => void
  onPreview: (file: StoredFile) => void
  onDownload: (file: StoredFile) => void
  onDelete: (file: StoredFile) => void
}) {
  // The caption carries the count, or the loading line; the error row speaks for itself.
  const caption = view.status === 'ready'
    ? `${plural(view.total, 'fișier', 'fișiere')}${view.refreshing ? ' · Se actualizează…' : ''}`
    : view.status === 'loading' ? 'Se încarcă fișierele…' : 'Fișiere'

  return (
    <div className="files-frame">
      <table className="files-table">
        <caption className={view.status === 'error' ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fișier</th>
            <th className="col-owner" scope="col">Proprietar</th>
            <th className="col-uploaded" scope="col">Încărcat</th>
            <th className="col-size num" scope="col">Dimensiune</th>
            <th className="col-actions" scope="col"><span className="sr-only">Acțiuni</span></th>
          </tr>
        </thead>
        <tbody>
          {view.status === 'error' && (
            <tr>
              <td className="state-cell" colSpan={5}>
                <div className="request-error" role="alert">
                  <p>Fișierele nu au putut fi încărcate. {view.error}</p>
                  <button type="button" disabled={view.retrying} onClick={onRetry}>{view.retrying ? 'Se reîncearcă…' : 'Reîncearcă'}</button>
                </div>
              </td>
            </tr>
          )}
          {view.status === 'ready' && view.files.length === 0 && (
            <tr>
              <td className="state-cell" colSpan={5}>
                <p className="empty-state">{view.total === 0 ? 'Nu există încă fișiere încărcate.' : 'Nu există fișiere pe această pagină.'}</p>
              </td>
            </tr>
          )}
          {view.status === 'ready' && view.files.map((file) => {
            const size = byteSize(file.size)
            const name = file.originalName
            return (
              <tr key={file.id}>
                <th className="file-cell" scope="row">
                  <span className="file-name">{name}</span>
                  <span className="cell-sub">{fileTypeLabel(file.mimeType)}</span>
                </th>
                <td className="owner-cell"><OwnerLabel ownerId={file.ownerId} /></td>
                <td className="uploaded-cell">
                  <time dateTime={file.createdAt}>
                    {formatLocalDay(file.createdAt)}<span className="cell-sub">{formatLocalTime(file.createdAt)}</span>
                  </time>
                </td>
                <td className="size-cell num">{size.value}<span className="unit"> {size.unit}</span></td>
                <td className="actions-cell">
                  <div className="file-actions">
                    {fileKind(file.mimeType) !== 'other' && (
                      <button type="button" className="ghost-button" onClick={() => onPreview(file)}>
                        Previzualizează<span className="sr-only"> {name}</span>
                      </button>
                    )}
                    {fileKind(file.mimeType) === 'video' && (
                      <Link to="/files/$fileId/edit" params={{ fileId: file.id }} className="ghost-button">
                        Editează<span className="sr-only"> {name}</span>
                      </Link>
                    )}
                    <button type="button" className="text-button" disabled={downloading.has(file.id)} onClick={() => onDownload(file)}>
                      {downloading.has(file.id) ? 'Se descarcă…' : 'Descarcă'}<span className="sr-only"> {name}</span>
                    </button>
                    <button type="button" className="text-button danger" disabled={deleting !== undefined} onClick={() => onDelete(file)}>
                      {deleting === file.id ? 'Se șterge…' : 'Șterge'}<span className="sr-only"> {name}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {view.status === 'ready' && (
        <Pagination offset={offset} pageSize={pageSize} total={view.total} label="Pagini cu fișiere" onPage={onPage} />
      )}
    </div>
  )
}
