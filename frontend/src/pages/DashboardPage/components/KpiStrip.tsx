import { formatCount, formatDay, formatHourValue, formatTime, formatWindow, percent, plural } from '../dashboardData'
import type { Kpis } from '../dashboardData'
import { asOf, operatingDay } from '../sampleData'

export default function KpiStrip({ figures }: { figures: Kpis }) {
  return (
    <dl className="kpi-strip" aria-label="Astăzi în cifre">
      <div className="kpi">
        <dt>Rezervate acum</dt>
        <dd className="kpi-value num">{formatCount(figures.bookedNow)}<span className="unit"> din {plural(figures.carsInService, 'mașină', 'mașini')}</span></dd>
        <dd className="kpi-note">{figures.carsInMaintenance === 0 ? 'Întreaga flotă este în serviciu' : `${plural(figures.carsInMaintenance, 'mașină', 'mașini')} în mentenanță astăzi`}</dd>
      </div>
      <div className="kpi">
        <dt>Ore-mașină rezervate</dt>
        <dd className="kpi-value num">{formatHourValue(figures.bookedHours)}<span className="unit"> din {formatHourValue(figures.offeredHours)}</span></dd>
        <dd className="kpi-note">{percent(figures.bookedHours, figures.offeredHours)}% din orele disponibile astăzi, {formatWindow(operatingDay.start, operatingDay.end)}</dd>
      </div>
      <div className="kpi">
        <dt>Redare raportată</dt>
        <dd className="kpi-value num">{formatHourValue(figures.playedHours)}<span className="unit"> din {formatHourValue(figures.scheduledHours)} h</span></dd>
        <dd className="kpi-note">{percent(figures.playedHours, figures.scheduledHours)}% din orele programate până la {formatTime(asOf.time)}</dd>
      </div>
      <div className="kpi">
        <dt>Credite săptămâna aceasta</dt>
        <dd className="kpi-value num">{formatCount(figures.creditsThisWeek)}<span className="unit"> cr</span></dd>
        <dd className="kpi-note">{plural(figures.campaignsThisWeek, 'campanie confirmată', 'campanii confirmate')} din {formatDay(asOf.weekStart)}</dd>
      </div>
    </dl>
  )
}
