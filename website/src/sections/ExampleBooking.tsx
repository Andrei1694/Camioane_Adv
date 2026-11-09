import type { CSSProperties } from 'react'
import { formatCount, formatHours, formatWindow, plural } from '../lib/format'
import { exampleSlot as slot, minutesOf } from '../lib/pricing'

// The axis runs from the hour the slot starts in to half an hour past the hour it ends in.
const axisStart = Math.floor(minutesOf(slot.start) / 60) * 60
const axisEnd = Math.ceil(minutesOf(slot.end) / 60) * 60 + 30
const share = (minutes: number) => (minutes / (axisEnd - axisStart)) * 100
const ticks = Array.from({ length: Math.floor((axisEnd - axisStart) / 60) + 1 }, (_, index) => axisStart + index * 60)
const hourLabel = (minutes: number) => `${String(minutes / 60).padStart(2, '0')}:00`
const cars = Array.from({ length: slot.cars }, (_, index) => `Mașina ${formatCount(index + 1)}`)

/** Places a band on the track; bars are inset 1px at each end so neighbours part with a 2px seam. */
function bandStyle(start: string, end: string, inset = 0): CSSProperties {
  return {
    left: `calc(${share(minutesOf(start) - axisStart)}% + ${inset}px)`,
    width: `calc(${share(minutesOf(end) - minutesOf(start))}% - ${inset * 2}px)`,
  }
}

const gridlines = ticks.map(tick => (
  <span key={tick} className="chart-gridline" style={{ left: `${share(tick - axisStart)}%` }} />
))

export default function ExampleBooking() {
  return (
    <figure className="example-booking">
      <div className="example-head">
        <div>
          <p className="example-title">Exemplu de rezervare</p>
          <p className="example-meta">
            {plural(slot.cars, 'mașină', 'mașini')} · {formatWindow(slot.start, slot.end)} · {formatHours(slot.carHours)} ore-mașină
          </p>
        </div>
        <p className="example-total num">{formatCount(slot.credits)}<span className="unit"> cr</span></p>
      </div>
      <p className="sr-only">
        {plural(slot.cars, 'mașină', 'mașini')} pe un traseu,{' '}
        {slot.rows.map(row => `${formatWindow(row.start, row.end)} la ${plural(row.rate, 'credit', 'credite')} pe oră-mașină`).join(', apoi ')}.
      </p>
      <div className="example-chart" aria-hidden="true">
        <div className="chart-row">
          <span />
          <div className="chart-track chart-axis">
            {ticks.map(tick => (
              <span key={tick} className="chart-tick num" style={{ left: `${share(tick - axisStart)}%` }}>{hourLabel(tick)}</span>
            ))}
          </div>
        </div>
        <div className="chart-row">
          <span className="chart-label">Tarif</span>
          <div className="chart-track">
            {gridlines}
            {slot.rows.map(row => (
              <span key={row.start} className="chart-rate num" style={bandStyle(row.start, row.end)}>{formatCount(row.rate)}</span>
            ))}
          </div>
        </div>
        {cars.map(car => (
          <div key={car} className="chart-row">
            <span className="chart-label">{car}</span>
            <div className="chart-track">
              {gridlines}
              {slot.rows.map(row => (
                <span key={row.start} className="chart-bar" style={bandStyle(row.start, row.end, 1)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="example-caption">
        Tarife în credite pe oră-mașină. Valorile ilustrează calculul și nu reprezintă o listă de prețuri.
      </figcaption>
    </figure>
  )
}
