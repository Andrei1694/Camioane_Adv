import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import Contact from '../src/sections/Contact'

// Isolate this import from the supported-clipboard suite without reloading React.
vi.hoisted(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

it('keeps email contact available without displaying an unsupported copy action', () => {
  render(<Contact />)

  expect(screen.queryByRole('button', { name: 'Copiază adresa' })).not.toBeInTheDocument()
  expect(screen.getByText('campaign@example.com')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Scrie-ne' })).toHaveAttribute(
    'href', 'mailto:campaign@example.com?subject=Campanie%20publicitar%C4%83',
  )
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
