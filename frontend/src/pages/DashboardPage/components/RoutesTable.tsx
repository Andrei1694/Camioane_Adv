import { formatCount, formatHours, formatTime, percent } from '../dashboardData'
import type { RouteDay } from '../dashboardData'
import { asOf, peakWindow } from '../sampleData'

export default function RoutesTable({ days }: { days: RouteDay[] }) {
  return (
    <section className="panel routes-panel" aria-labelledby="routes-title">
      <div className="panel-header">
        <h2 id="routes-title">Trasee astăzi</h2>
        <p className="panel-meta">Tarife în credite pe mașină-oră; ore de vârf {formatTime(peakWindow.start)}–{formatTime(peakWindow.end)}</p>
      </div>
      <table className="routes-table">
        <thead>
          <tr>
            <th scope="col">Traseu</th>
            <th scope="col" className="num">Mașini în serviciu</th>
            <th scope="col" className="num">Ore-mașină rezervate</th>
            <th scope="col" className="num">Redat până la {formatTime(asOf.time)}</th>
            <th scope="col" className="num">Tarif în afara orelor de vârf</th>
            <th scope="col" className="num">Tarif la ore de vârf</th>
            <th scope="col" className="num">Următoarea mașină disponibilă</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const share = percent(day.bookedMinutes, day.offeredMinutes)
            return (
              <tr key={day.route.id}>
                <th scope="row">
                  <span className="route-name">{day.route.name}</span>
                  <span className="cell-sub">{day.route.corridor}</span>
                </th>
                <td className="num" data-label="Mașini în serviciu">{formatCount(day.carsInService)}<span className="unit"> din {formatCount(day.cars.length)}</span></td>
                <td className="num" data-label="Rezervat">
                  {formatHours(day.bookedMinutes)}<span className="unit"> din {formatHours(day.offeredMinutes)}</span>
                  <span className="share-track" aria-hidden="true"><span className="share-fill" style={{ width: `${share}%` }} /></span>
                </td>
                <td className="num" data-label="Redat">
                  <span className={day.playedSoFar < day.scheduledSoFar ? 'shortfall' : undefined}>{formatHours(day.playedSoFar)}</span>
                  <span className="unit"> din {formatHours(day.scheduledSoFar)}</span>
                </td>
                <td className="num" data-label="În afara orelor de vârf">{formatCount(day.route.offPeakRate)}</td>
                <td className="num" data-label="Ore de vârf">{formatCount(day.route.peakRate)}</td>
                <td className="num" data-label="Următoarea disponibilă">
                  {day.nextFree
                    ? <>{day.nextFree.time <= asOf.time ? 'Acum' : formatTime(day.nextFree.time)} <span className="cell-sub plate">{day.nextFree.plate}</span></>
                    : <span className="missing">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
