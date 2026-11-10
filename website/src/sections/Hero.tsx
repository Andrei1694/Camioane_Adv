import { contactHref } from '../lib/contact'
import ExampleBooking from './ExampleBooking'

export default function Hero() {
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div>
          <h1 id="hero-title">Reclama ta pe ecrane LED care străbat orașul</h1>
          <p className="hero-lead">
            Rezervă cu ora mașinile noastre cu ecrane LED pe plafon, pe trasee prestabilite. Fiecare mașină rezervată
            afișează exclusiv campania ta pe toată durata intervalului.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={contactHref}>Planifică o campanie</a>
            <a className="button" href="#pricing">Cum se calculează costul</a>
          </div>
        </div>
        <div className="hero-visual">
          <ExampleBooking />
        </div>
      </div>
    </section>
  )
}
