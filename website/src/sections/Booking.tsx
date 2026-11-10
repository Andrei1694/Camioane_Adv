import Section from '../components/Section'

const terms = [
  { term: 'Trasee', detail: 'Trasee prestabilite, parcurse de mașinile și șoferii noștri, după un orar publicat.' },
  { term: 'Intervale', detail: 'O plecare fixă sau o perioadă rezervabilă pe un traseu, cu ore de început și de sfârșit stabilite.' },
  { term: 'Mașini', detail: 'Câte mașini vrei pe fiecare traseu, în fiecare interval.' },
  { term: 'Date', detail: 'Date specifice, un program recurent sau o combinație între cele două.' },
  { term: 'Trasee simultane', detail: 'Mai multe trasee în același interval, fiecare cu propriul număr de mașini.' },
  { term: 'Ecrane exclusive', detail: 'O mașină rezervată afișează doar campania ta pe toată durata intervalului, fără alternare cu reclamele altor clienți.' },
]

export default function Booking() {
  return (
    <Section
      id="booking"
      title="Ce rezervi"
      lead="O campanie cuprinde intervalele rezervate pe traseele noastre. Tu alegi traseele, orele și numărul de mașini; noi ne ocupăm de deplasare."
      layout="stacked"
      className="section-booking"
    >
      <dl className="term-list grid-3">
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
