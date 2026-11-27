import Brand from './Brand'

// The footer needs no live clock.
const year = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="brand"><Brand /></p>
        <a className="text-link footer-demo-link" href="/demo-map-hero">Demo Map Hero</a>
        <p>© {year} Camioane App · Publicitate pe mașini cu ecrane LED</p>
      </div>
    </footer>
  )
}
