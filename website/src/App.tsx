import './App.css'
import Brand from './components/Brand'
import SiteFooter from './components/SiteFooter'
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

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Sari la conținut</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="Camioane App"><Brand /></a>
          <nav aria-label="Secțiuni">
            <ul className="site-nav">
              {navigation.map(({ href, label }) => (
                <li key={href} className="nav-section"><a href={href}>{label}</a></li>
              ))}
              <li><a className="button" href="#contact">Contact</a></li>
              <li><a className="button" href="/account">Contul meu</a></li>
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
      <SiteFooter />
    </>
  )
}
