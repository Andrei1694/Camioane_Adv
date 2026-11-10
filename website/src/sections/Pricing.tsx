import { Fragment } from 'react'
import Section from '../components/Section'
import { formatCount, formatHours, formatWindow, plural } from '../lib/format'
import { exampleSlot as slot } from '../lib/pricing'

const changes = slot.rows.slice(1).map(row => row.start).join(' și ')

// The slot formula with the example's own figures, e.g. 2 × (0,5 h × 20 + 1,0 h × 30) = 80 cr.
const bandTerms = slot.rows.map(row => ({ key: row.start, text: `${formatHours(row.hours)} h × ${formatCount(row.rate)}` }))

export default function Pricing() {
  return (
    <Section
      id="pricing"
      title="Tarife în credite"
      lead="Cumperi credite la un preț unic. Costul unei campanii se calculează în ore-mașină: o mașină rezervată timp de o oră. Tariful în credite depinde de traseu și de momentul zilei."
      layout="stacked"
    >
      <div className="formula">
        <p><strong>Costul unui interval</strong> = numărul de mașini × suma (orelor din fiecare segment tarifar × tariful segmentului)</p>
        <p className="formula-example">
          Pentru exemplul de mai jos:{' '}
          <span className="formula-figures num">
            {formatCount(slot.cars)} × (
            {bandTerms.map(({ key, text }, index) => (
              <Fragment key={key}>{index > 0 && ' + '}<span className="nowrap">{text}</span></Fragment>
            ))}
            ) = <span className="nowrap">{formatCount(slot.credits)}<span className="unit"> cr</span></span>
          </span>
        </p>
        <p><strong>Costul campaniei</strong> = suma costurilor tuturor intervalelor, pentru toate datele</p>
      </div>
      <div className="table-frame">
        <table className="price-table">
          <caption>
            Exemplu: {plural(slot.cars, 'mașină', 'mașini')} pe un traseu, {formatWindow(slot.start, slot.end)}, cu
            schimbarea tarifului la {changes}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Segment tarifar</th>
              <th scope="col" className="numeric">Ore</th>
              <th scope="col" className="numeric">Tarif (cr/oră-mașină)</th>
              <th scope="col" className="numeric">Mașini</th>
              <th scope="col" className="numeric">Credite</th>
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
        Tarifele din exemplu ilustrează calculul și nu reprezintă o listă de prețuri.{' '}
        <a className="text-link" href="#contact">Contactează-ne</a> pentru tarifele traseelor tale.
      </p>
    </Section>
  )
}
