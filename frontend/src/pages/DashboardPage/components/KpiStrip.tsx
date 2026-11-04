import { formatCount, formatDay, formatHourValue, formatTime, formatWindow, percent, plural } from '../dashboardData'
import type { Kpis } from '../dashboardData'
import { asOf, operatingDay } from '../sampleData'

export default function KpiStrip({ figures }: { figures: Kpis }) {
  return (
    <dl className="kpi-strip" aria-label="Today in numbers">
      <div className="kpi">
        <dt>Booked now</dt>
        <dd className="kpi-value num">{formatCount(figures.bookedNow)}<span className="unit"> of {plural(figures.carsInService, 'car')}</span></dd>
        <dd className="kpi-note">{figures.carsInMaintenance === 0 ? 'Whole fleet in service' : `${plural(figures.carsInMaintenance, 'car')} in maintenance today`}</dd>
      </div>
      <div className="kpi">
        <dt>Car-hours booked</dt>
        <dd className="kpi-value num">{formatHourValue(figures.bookedHours)}<span className="unit"> of {formatHourValue(figures.offeredHours)}</span></dd>
        <dd className="kpi-note">{percent(figures.bookedHours, figures.offeredHours)}% of today's in-service hours, {formatWindow(operatingDay.start, operatingDay.end)}</dd>
      </div>
      <div className="kpi">
        <dt>Playback reported</dt>
        <dd className="kpi-value num">{formatHourValue(figures.playedHours)}<span className="unit"> of {formatHourValue(figures.scheduledHours)} h</span></dd>
        <dd className="kpi-note">{percent(figures.playedHours, figures.scheduledHours)}% of the hours due by {formatTime(asOf.time)}</dd>
      </div>
      <div className="kpi">
        <dt>Credits this week</dt>
        <dd className="kpi-value num">{formatCount(figures.creditsThisWeek)}<span className="unit"> cr</span></dd>
        <dd className="kpi-note">{plural(figures.campaignsThisWeek, 'campaign')} confirmed since {formatDay(asOf.weekStart)}</dd>
      </div>
    </dl>
  )
}
