import { fileKind, fileTypeLabel } from '../../../lib/file'
import type { StoredFile } from '../../../lib/file'
import { byteSize, formatCount, formatLocalDay, formatLocalTime, plural } from '../../../lib/format'
import OwnerLabel from './OwnerLabel'

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
    ? `${plural(view.total, 'file')}${view.refreshing ? ' · Refreshing…' : ''}`
    : view.status === 'loading' ? 'Loading files…' : 'Files'

  return (
    <div className="files-frame">
      <table className="files-table">
        <caption className={view.status === 'error' ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">File</th>
            <th className="col-owner" scope="col">Owner</th>
            <th className="col-uploaded" scope="col">Uploaded</th>
            <th className="col-size num" scope="col">Size</th>
            <th className="col-actions" scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {view.status === 'error' && (
            <tr>
              <td className="state-cell" colSpan={5}>
                <div className="request-error" role="alert">
                  <p>Couldn't load files. {view.error}</p>
                  <button type="button" disabled={view.retrying} onClick={onRetry}>{view.retrying ? 'Retrying…' : 'Retry'}</button>
                </div>
              </td>
            </tr>
          )}
          {view.status === 'ready' && view.files.length === 0 && (
            <tr>
              <td className="state-cell" colSpan={5}>
                <p className="empty-state">{view.total === 0 ? 'No files uploaded yet.' : 'No files on this page.'}</p>
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
                        Preview<span className="sr-only"> {name}</span>
                      </button>
                    )}
                    <button type="button" className="text-button" disabled={downloading.has(file.id)} onClick={() => onDownload(file)}>
                      {downloading.has(file.id) ? 'Downloading…' : 'Download'}<span className="sr-only"> {name}</span>
                    </button>
                    <button type="button" className="text-button danger" disabled={deleting !== undefined} onClick={() => onDelete(file)}>
                      {deleting === file.id ? 'Deleting…' : 'Delete'}<span className="sr-only"> {name}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {view.status === 'ready' && view.total > pageSize && (
        <nav className="files-pagination" aria-label="File pages">
          <p className="num">
            {formatCount(Math.min(offset + 1, view.total))}–{formatCount(Math.min(offset + pageSize, view.total))}
            <span className="unit"> of {formatCount(view.total)}</span>
          </p>
          <div className="pagination-buttons">
            <button type="button" className="ghost-button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - pageSize))}>
              Previous<span className="sr-only"> page</span>
            </button>
            <button type="button" className="ghost-button" disabled={offset + pageSize >= view.total} onClick={() => onPage(offset + pageSize)}>
              Next<span className="sr-only"> page</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
