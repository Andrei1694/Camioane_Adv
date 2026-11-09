import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'

describe('advertiser landing page', () => {
  it('provides one main heading and named sections', () => {
    render(<App />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const main = screen.getByRole('main')
    for (const name of [
      'Reclama ta pe ecrane LED care străbat orașul',
      'Ce rezervi',
      'Cum se desfășoară o campanie',
      'Tarife în credite',
      'Totul sau nimic',
      'Materialele tale publicitare pe ecrane',
      'Planifică prima ta campanie',
    ]) {
      expect(within(main).getByRole('region', { name })).toBeInTheDocument()
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('connects navigation and the skip link to existing, unique targets', () => {
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: 'Secțiuni' })
    for (const [name, href] of [
      ['Ce rezervi', '#booking'],
      ['Cum funcționează', '#how-it-works'],
      ['Tarife', '#pricing'],
      ['Contact', '#contact'],
    ]) {
      expect(within(navigation).getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(screen.getByRole('link', { name: 'Sari la conținut' })).toHaveAttribute('href', '#main')

    const ids = Array.from(document.querySelectorAll('[id]'), element => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href')
      if (href?.startsWith('#')) expect(document.getElementById(href.slice(1))).toBeInTheDocument()
    }
  })

  it('uses the same configured email address in both calls to action', () => {
    render(<App />)

    const href = 'mailto:campaign@example.com?subject=Campanie%20publicitar%C4%83'
    expect(screen.getByRole('link', { name: 'Planifică o campanie' })).toHaveAttribute('href', href)
    expect(screen.getByRole('link', { name: 'Scrie-ne' })).toHaveAttribute('href', href)
    expect(screen.getByText('campaign@example.com')).toBeInTheDocument()
  })

  it('shows independently verified pricing figures with accessible table headers', () => {
    render(<App />)

    const table = screen.getByRole('table', { name: /Exemplu: 2 mașini pe un traseu, 16:30–18:00/ })
    const columns = within(table).getAllByRole('columnheader')
    expect(columns.map(column => column.textContent)).toEqual([
      'Segment tarifar', 'Ore', 'Tarif (cr/oră-mașină)', 'Mașini', 'Credite',
    ])
    for (const column of columns) expect(column).toHaveAttribute('scope', 'col')
    for (const row of within(table).getAllByRole('rowheader')) expect(row).toHaveAttribute('scope', 'row')

    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map(row => Array.from(row.children, cell => cell.textContent))).toEqual([
      ['16:30–17:00', '0,5', '20', '2', '20 cr'],
      ['17:00–18:00', '1,0', '30', '2', '60 cr'],
      ['Total', '1,5', '', '', '80 cr'],
    ])
    expect(screen.getByText(/Pentru exemplul de mai jos:/)).toHaveTextContent('2 × (0,5 h × 20 + 1,0 h × 30) = 80 cr')
  })

  it('keeps the illustrative-price disclaimers beside both examples', () => {
    render(<App />)

    const hero = screen.getByRole('region', { name: 'Reclama ta pe ecrane LED care străbat orașul' })
    const example = within(hero).getByRole('figure')
    expect(example).toHaveTextContent('2 mașini · 16:30–18:00 · 3,0 ore-mașină')
    expect(example).toHaveTextContent('80 cr')
    expect(within(example).getByText(/Valorile ilustrează calculul și nu reprezintă o listă de prețuri/)).toBeInTheDocument()
    expect(example).toHaveTextContent('16:30–17:00 la 20 de credite pe oră-mașină, apoi 17:00–18:00 la 30 de credite pe oră-mașină')

    const pricing = screen.getByRole('region', { name: 'Tarife în credite' })
    expect(within(pricing).getByText(/Tarifele din exemplu ilustrează calculul și nu reprezintă o listă de prețuri/)).toBeInTheDocument()
    expect(within(pricing).getByRole('link', { name: 'Contactează-ne' })).toHaveAttribute('href', '#contact')
  })

  it('renders without contacting the backend even when its address is missing', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('DEV', false)

    render(<App />)

    expect(screen.getByRole('link', { name: 'Planifică o campanie' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})
