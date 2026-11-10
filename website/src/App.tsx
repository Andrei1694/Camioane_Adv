import './App.css'
import BrandMark from './components/BrandMark'
import Booking from './sections/Booking'
import Confirmation from './sections/Confirmation'
import Contact from './sections/Contact'
import Content from './sections/Content'
import Hero from './sections/Hero'
import HowItWorks from './sections/HowItWorks'
import Pricing from './sections/Pricing'

const navigation = [
  { href: '#booking', label: 'Ce rezervi' },
  { href: '#how-it-works', label: 'Cum funcționează' },
  { href: '#pricing', label: 'Tarife' },
]

// Read once when the page loads; the footer needs no live clock.
const year = new Date().getFullYear()

function Brand() {
  return <><BrandMark />Camioane App</>
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Sari la conținut</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top"><Brand /></a>
          <nav aria-label="Secțiuni">
            <ul className="site-nav">
              {navigation.map(({ href, label }) => (
                <li key={href} className="nav-section"><a href={href}>{label}</a></li>
              ))}
              <li><a className="button" href="#contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main">
        <Hero />
        <Booking />
        <HowItWorks />
        <Pricing />
        <Confirmation />
        <Content />
        <Contact />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <p className="brand"><Brand /></p>
          <p>© {year} Camioane App · Publicitate pe mașini cu ecrane LED</p>
        </div>
      </footer>
    </>
  )
}
