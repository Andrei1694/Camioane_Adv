import Section from '../components/Section'

const points = [
  {
    title: 'Aprobate înainte de afișare',
    detail: 'Echipa noastră verifică fiecare imagine sau videoclip înainte de a ajunge pe ecrane. Dacă înlocuiești un fișier, îl verificăm din nou.',
  },
  {
    title: 'Trimise direct pe ecrane',
    detail: 'Materialele aprobate și programul confirmat ajung la sistemul de control al ecranului fiecărei mașini, fără copiere manuală.',
  },
  {
    title: 'Ce s-a programat și ce s-a afișat',
    detail: 'Ecranele raportează ce au afișat, iar tu poți compara cu programul stabilit.',
  },
]

export default function Content() {
  return (
    <Section
      id="content"
      title="Materialele tale publicitare pe ecrane"
      lead="Imaginile sau videoclipurile încărcate sunt afișate doar după aprobarea echipei noastre."
      layout="stacked"
    >
      <ul className="points content-points">
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
