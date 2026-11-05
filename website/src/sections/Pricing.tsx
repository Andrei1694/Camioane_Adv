import { Fragment } from 'react'
import Section from '../components/Section'
import { formatCount, formatHours, formatWindow, plural } from '../lib/format'
import { exampleSlot as slot } from '../lib/pricing'

const changes = slot.rows.slice(1).map(row => row.start).join(' and ')

// The slot formula with the example's own figures, e.g. 2 × (0.5 h × 20 + 1.0 h × 30) = 80 cr.
const bandTerms = slot.rows.map(row => ({ key: row.start, text: `${formatHours(row.hours)} h × ${formatCount(row.rate)}` }))

export default function Pricing() {
  return (
    <Section
      id="pricing"
      title="Pricing in credits"
      lead="You buy credits at one standard price. A campaign spends them by the car-hour, one car booked for one hour, at a rate set by the route and the time of day."
    >
      <div className="formula">
        <p><strong>Slot cost</strong> = cars × the sum of (hours in each rate band × that band's rate)</p>
        <p className="formula-example">
          For the example below:{' '}
          <span className="formula-figures num">
            {formatCount(slot.cars)} × (
            {bandTerms.map(({ key, text }, index) => (
              <Fragment key={key}>{index > 0 && ' + '}<span className="nowrap">{text}</span></Fragment>
            ))}
            ) = <span className="nowrap">{formatCount(slot.credits)}<span className="unit"> cr</span></span>
          </span>
        </p>
        <p><strong>Campaign cost</strong> = the sum of all its slots, on every date</p>
      </div>
      <div className="table-frame">
        <table className="price-table">
          <caption>
            Example: {plural(slot.cars, 'car')} on one route, {formatWindow(slot.start, slot.end)}, with the rate
            changing at {changes}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rate band</th>
              <th scope="col" className="numeric">Hours</th>
              <th scope="col" className="numeric">Rate (cr/car-h)</th>
              <th scope="col" className="numeric">Cars</th>
              <th scope="col" className="numeric">Credits</th>
            </tr>
          </thead>
          <tbody>
            {slot.rows.map(row => (
              <tr key={row.start}>
                <th scope="row" className="num">{formatWindow(row.start, row.end)}</th>
                <td className="numeric num">{formatHours(row.hours)}</td>
                <td className="numeric num">{formatCount(row.rate)}</td>
                <td className="numeric num">{formatCount(slot.cars)}</td>
                <td className="numeric num">{formatCount(row.credits)}<span className="unit"> cr</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="numeric num">{formatHours(slot.hours)}</td>
              <td />
              <td />
              <td className="numeric num">{formatCount(slot.credits)}<span className="unit"> cr</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="table-note">
        Example rates that show the arithmetic, not a price list. <a className="text-link" href="#contact">Ask us</a> for
        the rates on your routes.
      </p>
    </Section>
  )
}
