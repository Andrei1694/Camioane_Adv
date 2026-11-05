import Section from '../components/Section'

const terms = [
  { term: 'Routes', detail: 'Set routes, driven by our own cars and drivers on a published timetable.' },
  { term: 'Slots', detail: 'A fixed departure or a bookable period on a route, with a set start and end.' },
  { term: 'Cars', detail: 'How many cars you want on each route in each slot.' },
  { term: 'Dates', detail: 'Specific dates, a recurring schedule, or a mix of the two.' },
  { term: 'Parallel routes', detail: 'Several routes in the same slot, each with its own number of cars.' },
  { term: 'Exclusive screens', detail: 'A booked car plays only your campaign for the whole slot. No rotation with other advertisers.' },
]

export default function Booking() {
  return (
    <Section
      id="booking"
      title="What you book"
      lead="A campaign is a set of slots on our routes. You choose the routes, the times and how many cars; we drive them."
    >
      <dl className="term-list">
        {terms.map(({ term, detail }) => (
          <div key={term} className="term">
            <dt>{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
