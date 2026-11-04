import { useEffect, useId, useRef, useState } from 'react'
import { formatCount, formatDay, formatHours, formatStamp, formatWindow, instanceDates, plural, routeOf } from '../dashboardData'
import type { RequestReview } from '../dashboardData'
import { cars } from '../sampleData'

export type Decision = 'changes' | 'rejected'

export default function BookingReviewDialog({ review, onClose, onConfirm, onDecide }: {
  review: RequestReview
  onClose: () => void
  onConfirm: (review: RequestReview) => void
  onDecide: (review: RequestReview, decision: Decision, note: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const id = useId()
  const { request, client, creative } = review
  const blocked = review.blockers.length > 0

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  function finish(action: () => void) {
    action()
    dialog.current?.close()
  }

  function decide(decision: Decision) {
    if (!note.trim()) {
      setNoteError('Write a note so the client knows what to change or why the request was declined.')
      return
    }
    finish(() => onDecide(review, decision, note.trim()))
  }

  return (
    <dialog ref={dialog} className="dialog review-dialog" aria-labelledby={`${id}-title`} onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      <div className="dialog-head">
        <div>
          <h2 id={`${id}-title`}>{request.campaign}</h2>
          <p className="dialog-sub">{client.name} · sent {formatStamp(request.submittedAt)}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close review" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <dl className="review-checks">
        <div className={review.shortfalls.length ? 'check check-fail' : 'check'}>
          <dt>Cars</dt>
          <dd>
            {review.shortfalls.length === 0
              ? `All ${plural(review.instances, 'slot')} have enough free cars.`
              : review.shortfalls.map((gap) => (
                <span key={`${gap.routeId}-${gap.date}`} className="check-line">
                  {formatDay(gap.date)} {formatWindow(gap.start, gap.end)} {routeOf(gap.routeId).name}: {gap.free} of {gap.needed} cars free
                </span>
              ))}
          </dd>
        </div>
        <div className={review.balance < review.total ? 'check check-fail' : 'check'}>
          <dt>Balance</dt>
          <dd>
            <span className="num">{formatCount(review.balance)} cr</span> available,{' '}
            {review.balance >= review.total
              ? <>leaves <span className="num">{formatCount(review.balance - review.total)} cr</span> after this booking.</>
              : <>short by <span className="num">{formatCount(review.total - review.balance)} cr</span>.</>}
          </dd>
        </div>
        <div className={creative?.status === 'approved' ? 'check' : 'check check-fail'}>
          <dt>Creative</dt>
          <dd>
            {creative
              ? `${creative.file}, version ${creative.version}: ${creative.status === 'approved' ? 'approved' : creative.status === 'rejected' ? 'rejected' : 'waiting for review'}.`
              : 'No creative uploaded yet.'}
          </dd>
        </div>
      </dl>

      <h3 className="review-section-title">Schedule</h3>
      <ul className="schedule-list">
        {request.entries.map((entry, index) => {
          const fleet = cars.filter((car) => car.routeId === entry.routeId).length
          return (
            <li key={index}>
              <p className="row-title">{routeOf(entry.routeId).name} · {formatWindow(entry.start, entry.end)} · {entry.cars} of {fleet} cars</p>
              <p className="row-meta">{instanceDates(entry).map(formatDay).join(', ')}</p>
            </li>
          )
        })}
      </ul>

      <div className="table-frame">
        <table className="price-table">
          <caption>Price by tariff band</caption>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Window</th>
              <th scope="col" className="num">Rate</th>
              <th scope="col" className="num">Hours</th>
              <th scope="col" className="num">Cars</th>
              <th scope="col" className="num">Dates</th>
              <th scope="col" className="num">Credits</th>
            </tr>
          </thead>
          <tbody>
            {review.lines.map((line) => (
              <tr key={`${line.routeId}-${line.start}`}>
                <td>{routeOf(line.routeId).name}</td>
                <td>{formatWindow(line.start, line.end)} <span className="cell-sub">{line.band}</span></td>
                <td className="num">{line.rate}<span className="unit"> cr/car-h</span></td>
                <td className="num">{formatHours(line.end - line.start)}</td>
                <td className="num">{line.cars}</td>
                <td className="num">{line.dates}</td>
                <td className="num">{formatCount(line.credits)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={6}>Total</th>
              <td className="num">{formatCount(review.total)}<span className="unit"> cr</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="form-field review-note">
        <label htmlFor={`${id}-note`}>Note to the client</label>
        <textarea id={`${id}-note`} rows={2} value={note} aria-invalid={noteError ? true : undefined}
          aria-describedby={`${id}-note-hint`} onChange={(event) => { setNote(event.target.value); setNoteError('') }} />
        <p id={`${id}-note-hint`} className={noteError ? 'field-error' : 'field-hint'}>
          {noteError || 'Needed to request changes or reject. Not needed to confirm.'}
        </p>
      </div>

      <div className="review-actions">
        <button type="button" className="primary-button" disabled={blocked} aria-describedby={blocked ? `${id}-blocked` : undefined}
          onClick={() => finish(() => onConfirm(review))}>
          Confirm and debit {formatCount(review.total)} cr
        </button>
        <button type="button" onClick={() => decide('changes')}>Request changes</button>
        <button type="button" className="text-button danger" onClick={() => decide('rejected')}>Reject</button>
      </div>
      {blocked && <p id={`${id}-blocked`} className="review-blocked">Can't confirm yet. {review.blockers.join(' ')}</p>}
    </dialog>
  )
}
