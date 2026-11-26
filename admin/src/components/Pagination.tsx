import { formatCount } from '../lib/format'

/** "1–50 of 132" with Previous and Next, in the API's page steps. Shows only when there is more than one page. */
export default function Pagination({ offset, pageSize, total, label, onPage }: {
  offset: number
  pageSize: number
  total: number
  /** Names the list for assistive technology, for example "File pages". */
  label: string
  onPage: (offset: number) => void
}) {
  if (total <= pageSize) return null
  return (
    <nav className="pagination" aria-label={label}>
      <p className="num">
        {formatCount(Math.min(offset + 1, total))}–{formatCount(Math.min(offset + pageSize, total))}
        <span className="unit"> din {formatCount(total)}</span>
      </p>
      <div className="pagination-buttons">
        <button type="button" className="ghost-button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - pageSize))}>
          Înapoi<span className="sr-only"> la pagina anterioară</span>
        </button>
        <button type="button" className="ghost-button" disabled={offset + pageSize >= total} onClick={() => onPage(offset + pageSize)}>
          Înainte<span className="sr-only"> la pagina următoare</span>
        </button>
      </div>
    </nav>
  )
}
