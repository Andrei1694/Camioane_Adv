import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Contact from '../src/sections/Contact'

// Contact reads capability at import time; each test's user-event session supplies the stub itself.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} })
})

describe('contact clipboard feedback', () => {
  it('copies the configured email and announces success', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<Contact />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: 'Copiază adresa' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith('campaign@example.com')
    expect(screen.getByRole('status')).toHaveTextContent('Adresa a fost copiată.')
  })

  it('offers manual-copy guidance when clipboard access fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    render(<Contact />)

    await user.click(screen.getByRole('button', { name: 'Copiază adresa' }))

    expect(screen.getByRole('status')).toHaveTextContent('Adresa nu a putut fi copiată. Selecteaz-o și copiaz-o manual.')
    expect(screen.getByText('campaign@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scrie-ne' })).toHaveAttribute('href', expect.stringContaining('mailto:campaign@example.com'))
  })

  it('can recover from a failed attempt with a successful retry', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('Clipboard unavailable'))
      .mockResolvedValueOnce()
    render(<Contact />)
    const button = screen.getByRole('button', { name: 'Copiază adresa' })

    await user.click(button)
    expect(screen.getByRole('status')).toHaveTextContent('Selecteaz-o și copiaz-o manual.')
    await user.click(button)

    expect(writeText).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Adresa a fost copiată.')
    expect(screen.getByRole('status')).not.toHaveTextContent('manual')
  })

  it('allows keyboard activation of the copy button', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<Contact />)

    await user.tab()
    expect(screen.getByRole('link', { name: 'Scrie-ne' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Copiază adresa' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(writeText).toHaveBeenCalledWith('campaign@example.com')
    expect(screen.getByRole('status')).toHaveTextContent('Adresa a fost copiată.')
  })
})
