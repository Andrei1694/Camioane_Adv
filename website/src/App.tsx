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
  { href: '#booking', label: 'What you book' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
]

// Read once when the page loads; the footer needs no live clock.
const year = new Date().getFullYear()

function Brand() {
  return <><BrandMark />Camioane App</>
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header id="top" className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top"><Brand /></a>
          <nav aria-label="Sections">
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
          <p>© {year} Camioane App · Advertising on LED-screen cars</p>
        </div>
      </footer>
    </>
  )
}
