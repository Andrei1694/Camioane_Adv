import Section from '../components/Section'

const points = [
  {
    title: 'Fiecare interval, fiecare mașină',
    detail: 'Dacă lipsește chiar și o singură mașină la una dintre date, nu se rezervă nimic și nu se scad credite.',
  },
  {
    title: 'Creditele se scad la confirmare',
    detail: 'Trimiterea unei cereri nu blochează și nu scade credite. La confirmare, verificăm soldul și scădem costul integral în același pas cu rezervarea.',
  },
  {
    title: 'Fără rezervări parțiale',
    detail: 'O campanie se confirmă integral sau rămâne neconfirmată, iar tu vezi motivul.',
  },
  {
    title: 'Fără debitări duble',
    detail: 'Confirmarea repetată a aceleiași campanii nu scade creditele de două ori.',
  },
]

export default function Confirmation() {
  return (
    <Section
      id="confirmation"
      title="Totul sau nimic"
      lead="Confirmăm o campanie doar dacă o putem desfășura integral."
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
