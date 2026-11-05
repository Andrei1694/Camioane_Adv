import BrandMark from '../components/BrandMark'
import { contactHref } from '../lib/contact'
import ExampleBooking from './ExampleBooking'

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div>
          <h1 id="hero-title">Your ad on LED screens that drive through the city</h1>
          <p className="hero-lead">
            Book our cars with rooftop LED screens on set routes, by the hour. Each car you book shows only your
            campaign for the whole slot.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={contactHref}>Plan a campaign</a>
            <a className="button" href="#pricing">How pricing works</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-mark">
            <BrandMark className="hero-mark-svg" />
          </div>
          <ExampleBooking />
        </div>
      </div>
    </section>
  )
}
