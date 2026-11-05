import Section from '../components/Section'

const points = [
  {
    title: 'Every slot, every car',
    detail: 'If a single date is one car short, nothing is booked and nothing is charged.',
  },
  {
    title: 'Credits move at confirmation',
    detail: 'Sending a request neither holds nor debits credits. When we confirm, we check your balance and debit the full cost in the same step as the booking.',
  },
  {
    title: 'No partial bookings',
    detail: 'A campaign is confirmed whole, or it stays unconfirmed and you see why.',
  },
  {
    title: 'No double charges',
    detail: 'Confirming the same campaign twice never debits it twice.',
  },
]

export default function Confirmation() {
  return (
    <Section
      id="confirmation"
      title="All or nothing"
      lead="We confirm a campaign only when we can run all of it."
      layout="stacked"
    >
      <ul className="points grid-2">
        {points.map(({ title, detail }) => (
          <li key={title}>
            <h3>{title}</h3>
            <p>{detail}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
