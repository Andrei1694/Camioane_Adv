import { useEffect, useRef } from 'react'
import { bookingSegments, campaignOf, formatLongDay, formatTime, formatWindow, routeOf } from '../dashboardData'
import type { Segment, SegmentKind } from '../dashboardData'
import { asOf, cars, operatingDay, routes } from '../sampleData'
import type { Booking, Car } from '../sampleData'

type Kind = SegmentKind | 'maintenance'

// One map drives the bars, the screen-reader text and the legend, so a swatch is always its mark.
const kinds: Record<Kind, { label: string, describe: (start: number, end: number) => string }> = {
  played: { label: 'Redat', describe: (start, end) => `redat ${formatWindow(start, end)}` },
  'no-logs': { label: 'Redare încă neraportată', describe: (start, end) => `redare neraportată ${formatWindow(start, end)}` },
  scheduled: { label: 'Programat', describe: (start, end) => `programat ${formatWindow(start, end)}` },
  undelivered: { label: 'Conținut nelivrat', describe: (start, end) => `conținut nelivrat pentru ${formatWindow(start, end)}` },
  maintenance: { label: 'În mentenanță', describe: (start, end) => `în mentenanță ${formatWindow(start, end)}` },
}

const span = operatingDay.end - operatingDay.start
const at = (mins: number) => `${((mins - operatingDay.start) / span) * 100}%`
const ticks = Array.from({ length: span / 120 + 1 }, (_, index) => operatingDay.start + index * 120)

function BookingBar({ booking, now }: { booking: Booking, now: number }) {
  const { client, name } = campaignOf(booking)
  const segments = bookingSegments(booking, now)
  const widest = segments.reduce<Segment | null>((best, segment) => (!best || segment.end - segment.start > best.end - best.start ? segment : best), null)
  const length = booking.end - booking.start
  const description = `${client.name}, ${name}, ${formatWindow(booking.start, booking.end)}: ${segments.map((segment) => kinds[segment.kind].describe(segment.start, segment.end)).join(', ')}`
  return (
    <li className="bar" style={{ left: at(booking.start), width: `${(length / span) * 100}%` }} title={description}>
      <span className="sr-only">{description}</span>
      {segments.map((segment, index) => (
        // A 2px seam separates the parts of a booking split at now.
        <span key={segment.kind} aria-hidden="true" className={`seg seg-${segment.kind}`}
          style={{
            left: `${((segment.start - booking.start) / length) * 100}%`,
            width: `calc(${((segment.end - segment.start) / length) * 100}% - ${index < segments.length - 1 ? 2 : 0}px)`,
          }}>
          {segment === widest && segment.end - segment.start >= 50 && <span className="seg-label">{client.short}</span>}
        </span>
      ))}
    </li>
  )
}

function CarRow({ car, bookings, now }: { car: Car, bookings: Booking[], now: number }) {
  const own = bookings.filter((item) => item.plate === car.plate)
  const [firstName] = car.driver.split(' ')
  return (
    <div className="timeline-row">
      <p className="timeline-car"><span className="plate">{car.plate}</span> <span className="driver">{firstName}</span></p>
      <ul className="timeline-track" aria-label={`${car.plate}, ${car.driver}, ${routeOf(car.routeId).name}`}>
        {car.maintenance && (
          <li className="bar bar-maintenance" style={{ left: at(car.maintenance.start), width: `${((car.maintenance.end - car.maintenance.start) / span) * 100}%` }}>
            <span className="seg-label">În mentenanță</span>
          </li>
        )}
        {own.map((item) => <BookingBar key={item.id} booking={item} now={now} />)}
        {own.length === 0 && !car.maintenance && <li className="sr-only">Nicio rezervare astăzi</li>}
      </ul>
    </div>
  )
}

export default function FleetTimeline({ bookings, now = asOf.time }: { bookings: Booking[], now?: number }) {
  const frame = useRef<HTMLDivElement>(null)
  const present = new Set<Kind>(bookings.flatMap((item) => bookingSegments(item, now).map((segment) => segment.kind)))
  if (cars.some((car) => car.maintenance)) present.add('maintenance')

  // On a narrow screen the day scrolls inside its frame; open it two hours before now.
  useEffect(() => {
    const element = frame.current
    if (!element || element.scrollWidth <= element.clientWidth) return
    // The labels stay pinned on the left, so a scroll of x puts track position x right beside them.
    const track = element.querySelector('.timeline-track')?.getBoundingClientRect().width ?? 0
    element.scrollLeft = Math.max(0, ((now - 120 - operatingDay.start) / span) * track)
  }, [now])

  return (
    <section className="panel timeline-panel" aria-labelledby="fleet-today-title">
      <div className="panel-header">
        <h2 id="fleet-today-title">Flota astăzi</h2>
        <p className="panel-meta">{formatLongDay(asOf.date)}, {formatWindow(operatingDay.start, operatingDay.end)}</p>
      </div>
      <ul className="legend" aria-label="Legendă">
        {(Object.keys(kinds) as Kind[]).filter((kind) => present.has(kind)).map((kind) => (
          <li key={kind}><span className={`swatch seg-${kind}`} aria-hidden="true" />{kinds[kind].label}</li>
        ))}
      </ul>
      <div className="timeline-frame" ref={frame} tabIndex={0} role="region" aria-label="Flota astăzi, după mașină și oră">
        <div className="timeline">
          <div className="timeline-head" aria-hidden="true">
            <span className="timeline-corner" />
            <div className="timeline-axis">
              <span className="timeline-now-label" style={{ left: at(now) }}>Acum {formatTime(now)}</span>
              {ticks.map((tick, index) => (
                <span key={tick} className={`timeline-tick${index === 0 ? ' tick-start' : index === ticks.length - 1 ? ' tick-end' : ''}`}
                  style={{ left: at(tick) }}>{formatTime(tick)}</span>
              ))}
            </div>
          </div>
          <div className="timeline-body">
            <div className="timeline-grid" aria-hidden="true">
              {ticks.map((tick) => <span key={tick} className="gridline" style={{ left: at(tick) }} />)}
              <span className="now-line" style={{ left: at(now) }} />
            </div>
            {routes.map((route) => (
              <div key={route.id} className="timeline-group" role="group" aria-label={`Traseul ${route.name}`}>
                <p className="timeline-route">{route.name}</p>
                <div>
                  {cars.filter((car) => car.routeId === route.id).map((car) => <CarRow key={car.plate} car={car} bookings={bookings} now={now} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
