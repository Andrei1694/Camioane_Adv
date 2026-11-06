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
      setNoteError('Scrie o notă pentru a-i explica clientului ce trebuie să schimbe sau de ce cererea a fost respinsă.')
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
          <p className="dialog-sub">{client.name} · trimisă {formatStamp(request.submittedAt)}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Închide verificarea" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <dl className="review-checks">
        <div className={review.shortfalls.length ? 'check check-fail' : 'check'}>
          <dt>Mașini</dt>
          <dd>
            {review.shortfalls.length === 0
              ? `Mașini suficiente pentru ${plural(review.instances, 'interval', 'intervale')}.`
              : review.shortfalls.map((gap) => (
                <span key={`${gap.routeId}-${gap.date}`} className="check-line">
                  {formatDay(gap.date)} {formatWindow(gap.start, gap.end)} {routeOf(gap.routeId).name}: {formatCount(gap.free)} din {plural(gap.needed, 'mașină disponibilă', 'mașini disponibile')}
                </span>
              ))}
          </dd>
        </div>
        <div className={review.balance < review.total ? 'check check-fail' : 'check'}>
          <dt>Sold</dt>
          <dd>
            <span className="num">{formatCount(review.balance)} cr</span> disponibile,{' '}
            {review.balance >= review.total
              ? <>rămân <span className="num">{formatCount(review.balance - review.total)} cr</span> după această rezervare.</>
              : <>lipsesc <span className="num">{formatCount(review.total - review.balance)} cr</span>.</>}
          </dd>
        </div>
        <div className={creative?.status === 'approved' ? 'check' : 'check check-fail'}>
          <dt>Material publicitar</dt>
          <dd>
            {creative
              ? `${creative.file}, versiunea ${creative.version}: ${creative.status === 'approved' ? 'aprobat' : creative.status === 'rejected' ? 'respins' : 'în așteptarea verificării'}.`
              : 'Nu există încă niciun material publicitar încărcat.'}
          </dd>
        </div>
      </dl>

      <h3 className="review-section-title">Program</h3>
      <ul className="schedule-list">
        {request.entries.map((entry, index) => {
          const fleet = cars.filter((car) => car.routeId === entry.routeId).length
          return (
            <li key={index}>
              <p className="row-title">{routeOf(entry.routeId).name} · {formatWindow(entry.start, entry.end)} · {formatCount(entry.cars)} din {plural(fleet, 'mașină', 'mașini')}</p>
              <p className="row-meta">{instanceDates(entry).map(formatDay).join(', ')}</p>
            </li>
          )
        })}
      </ul>

      <div className="table-frame">
        <table className="price-table">
          <caption>Preț pe interval tarifar</caption>
          <thead>
            <tr>
              <th scope="col">Traseu</th>
              <th scope="col">Interval</th>
              <th scope="col" className="num">Tarif</th>
              <th scope="col" className="num">Ore</th>
              <th scope="col" className="num">Mașini</th>
              <th scope="col" className="num">Zile</th>
              <th scope="col" className="num">Credite</th>
            </tr>
          </thead>
          <tbody>
            {review.lines.map((line) => (
              <tr key={`${line.routeId}-${line.start}`}>
                <td>{routeOf(line.routeId).name}</td>
                <td>{formatWindow(line.start, line.end)} <span className="cell-sub">{line.band === 'Peak' ? 'Ore de vârf' : 'În afara orelor de vârf'}</span></td>
                <td className="num">{formatCount(line.rate)}<span className="unit"> cr/mașină-oră</span></td>
                <td className="num">{formatHours(line.end - line.start)}</td>
                <td className="num">{formatCount(line.cars)}</td>
                <td className="num">{formatCount(line.dates)}</td>
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
        <label htmlFor={`${id}-note`}>Notă pentru client</label>
        <textarea id={`${id}-note`} rows={2} value={note} aria-invalid={noteError ? true : undefined}
          aria-describedby={`${id}-note-hint`} onChange={(event) => { setNote(event.target.value); setNoteError('') }} />
        <p id={`${id}-note-hint`} className={noteError ? 'field-error' : 'field-hint'}>
          {noteError || 'Obligatorie pentru solicitarea modificărilor sau respingere. Opțională pentru confirmare.'}
        </p>
      </div>

      <div className="review-actions">
        <button type="button" className="primary-button" disabled={blocked} aria-describedby={blocked ? `${id}-blocked` : undefined}
          onClick={() => finish(() => onConfirm(review))}>
          Confirmă și debitează {formatCount(review.total)} cr
        </button>
        <button type="button" onClick={() => decide('changes')}>Solicită modificări</button>
        <button type="button" className="text-button danger" onClick={() => decide('rejected')}>Respinge</button>
      </div>
      {blocked && <p id={`${id}-blocked`} className="review-blocked">Confirmarea nu este încă posibilă. {review.blockers.join(' ')}</p>}
    </dialog>
  )
}
