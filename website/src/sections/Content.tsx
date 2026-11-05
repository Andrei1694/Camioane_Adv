import Section from '../components/Section'

const points = [
  {
    title: 'Approved before it airs',
    detail: 'Our team reviews each image or video before it goes to the screens. A replaced file is reviewed again.',
  },
  {
    title: 'Sent straight to the screens',
    detail: "Approved content and the confirmed schedule go to each car's screen controller, with no copying by hand.",
  },
  {
    title: 'Scheduled and played, side by side',
    detail: 'The screens report what they played, and you see it next to what was scheduled.',
  },
]

export default function Content() {
  return (
    <Section
      id="content"
      title="Your creative on screen"
      lead="The images or videos you upload go on air only once our team approves them."
    >
      <ul className="points">
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
