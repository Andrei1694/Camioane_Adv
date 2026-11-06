import { dayMinutes, formatDay, formatHours, formatTime, validIntervals } from '../campaign'
import type { CampaignDay } from '../campaign'

export default function DayTimeline({ day }: { day: CampaignDay }) {
  const intervals = validIntervals(day)
  return <section className="campaign-day-timeline" aria-label={`Ore de funcționare pentru ${formatDay(day.date)}`}>
    <div className="campaign-section-heading"><h3>{formatDay(day.date)}</h3><span className="num">{formatHours(dayMinutes(day))}</span></div>
    <div className="campaign-time-axis" aria-hidden="true">{[0, 6, 12, 18, 24].map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div>
    <div className="campaign-time-track" aria-hidden="true">
      {intervals.map((interval) => <span key={interval.id} className="campaign-time-slot"
        style={{ left: `${interval.start! / 14.4}%`, width: `${(interval.end! - interval.start!) / 14.4}%` }} />)}
    </div>
    <p className="campaign-timeline-labels">{intervals.length
      ? intervals.map((interval) => <span key={interval.id} className="num">{formatTime(interval.start!)}–{formatTime(interval.end!)}</span>)
      : 'Adaugă ore de funcționare pentru această zi.'}</p>
  </section>
}
