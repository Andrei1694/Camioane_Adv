import { dayMinutes, formatDay, formatHours, formatTime } from '../campaign'
import type { CampaignDay } from '../campaign'

export default function CampaignReview({ days, onEdit, readOnlyBefore }: { days: CampaignDay[], onEdit: (date: string) => void, readOnlyBefore: string }) {
  return <section className="campaign-agenda" aria-labelledby="campaign-agenda-title">
    <div className="campaign-section-heading"><h2 id="campaign-agenda-title">Campaign schedule</h2><span className="campaign-help">All times in Europe/Bucharest</span></div>
    <ul>
      {days.map((day) => <li key={day.date}>
        <div className="campaign-agenda-date">{formatDay(day.date)}</div>
        <div className="campaign-agenda-intervals num">{[...day.intervals].sort((a, b) => a.start! - b.start!).map((interval) => <span key={interval.id}>{formatTime(interval.start!)}–{formatTime(interval.end!)}</span>)}</div>
        <span className="campaign-agenda-total num">{formatHours(dayMinutes(day))}</span>
        {day.date < readOnlyBefore ? <span className="campaign-agenda-readonly campaign-help">Past · Read-only</span>
          : <button type="button" className="text-button" onClick={() => onEdit(day.date)} aria-label={`Edit hours for ${formatDay(day.date)}`}>Edit hours</button>}
      </li>)}
    </ul>
  </section>
}
