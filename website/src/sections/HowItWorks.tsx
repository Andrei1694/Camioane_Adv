import Section from '../components/Section'

const steps = [
  { title: 'Cumpără credite', detail: 'Alimentează-ți contul cu cardul. Creditele sunt adăugate după confirmarea plății.' },
  { title: 'Creează campania', detail: 'Alege traseele, intervalele, datele și numărul de mașini pe fiecare traseu.' },
  { title: 'Încarcă materialele publicitare', detail: 'Imagini sau videoclipuri, pe care echipa noastră le aprobă înainte de afișare.' },
  {
    title: 'Verifică și trimite',
    detail: 'Verifică fiecare interval, data și costul său în credite, apoi trimite cererea. În această etapă nu se scad credite din sold.',
  },
  {
    title: 'Noi confirmăm',
    detail: 'Echipa noastră verifică materialele și programul, apoi rezervă întreaga campanie și scade creditele aferente într-un singur pas.',
  },
  { title: 'Urmărește campania în desfășurare', detail: 'Vezi ce este programat, ce a ajuns pe ecrane și ce raportează ecranele că au afișat.' },
  {
    title: 'Schimbă planurile',
    detail: 'Solicită anularea anumitor intervale viitoare sau a tuturor celor rămase. Analizăm cererea și returnăm creditele conform politicii de anulare.',
  },
]

export default function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      title="Cum se desfășoară o campanie"
      lead="Tu planifici și plătești în credite din contul tău. Noi verificăm, confirmăm și trimitem mașinile pe traseu."
      layout="stacked"
      className="section-process"
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
