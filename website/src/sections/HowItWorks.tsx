import Section from '../components/Section'

const steps = [
  { title: 'Buy credits', detail: 'Top up your account by card. The credits land once the payment is confirmed.' },
  { title: 'Build the campaign', detail: 'Pick the routes, slots and dates, and the number of cars on each route.' },
  { title: 'Upload your creative', detail: 'Images or videos, for our team to approve before they go on screen.' },
  {
    title: 'Check and send',
    detail: 'Review every dated slot and what it costs in credits, then send the request. Nothing leaves your balance yet.',
  },
  {
    title: 'We confirm',
    detail: 'Our team checks the content and the schedule, then books the whole campaign and debits its credits in one step.',
  },
  { title: 'Follow it on the road', detail: 'See what is scheduled, what reached the screens and what the screens report as played.' },
  {
    title: 'Change plans',
    detail: 'Ask to cancel selected future slots, or all that remain. We review the request and return credits under the cancellation policy.',
  },
]

export default function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      title="How a campaign runs"
      lead="You plan and pay in credits from your account. We check, confirm and run the cars."
    >
      <ol className="steps">
        {steps.map(({ title, detail }) => (
          <li key={title} className="step">
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
