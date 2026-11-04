import { formatHours, formatTime, percent } from '../dashboardData'
import type { RouteDay } from '../dashboardData'
import { asOf, peakWindow } from '../sampleData'

export default function RoutesTable({ days }: { days: RouteDay[] }) {
  return (
    <section className="panel routes-panel" aria-labelledby="routes-title">
      <div className="panel-header">
        <h2 id="routes-title">Routes today</h2>
        <p className="panel-meta">Rates in credits per car-hour; peak runs {formatTime(peakWindow.start)}–{formatTime(peakWindow.end)}</p>
      </div>
      <table className="routes-table">
        <thead>
          <tr>
            <th scope="col">Route</th>
            <th scope="col" className="num">Cars in service</th>
            <th scope="col" className="num">Booked car-hours</th>
            <th scope="col" className="num">Played until {formatTime(asOf.time)}</th>
            <th scope="col" className="num">Off-peak rate</th>
            <th scope="col" className="num">Peak rate</th>
            <th scope="col" className="num">Next free car</th>
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
                <td className="num" data-label="Cars in service">{day.carsInService}<span className="unit"> of {day.cars.length}</span></td>
                <td className="num" data-label="Booked">
                  {formatHours(day.bookedMinutes)}<span className="unit"> of {formatHours(day.offeredMinutes)}</span>
                  <span className="share-track" aria-hidden="true"><span className="share-fill" style={{ width: `${share}%` }} /></span>
                </td>
                <td className="num" data-label="Played">
                  <span className={day.playedSoFar < day.scheduledSoFar ? 'shortfall' : undefined}>{formatHours(day.playedSoFar)}</span>
                  <span className="unit"> of {formatHours(day.scheduledSoFar)}</span>
                </td>
                <td className="num" data-label="Off-peak">{day.route.offPeakRate}</td>
                <td className="num" data-label="Peak">{day.route.peakRate}</td>
                <td className="num" data-label="Next free">
                  {day.nextFree
                    ? <>{day.nextFree.time <= asOf.time ? 'Now' : formatTime(day.nextFree.time)} <span className="cell-sub plate">{day.nextFree.plate}</span></>
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
