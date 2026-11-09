import { beforeEach, describe, expect, it, vi } from 'vitest'

// The contact values are read at module load, so each case needs a fresh import.
beforeEach(() => vi.resetModules())

describe('contact configuration', () => {
  it.each(['advertisers@example.com', '  advertisers@example.com  '])('uses the configured address %j', async email => {
    vi.stubEnv('VITE_CONTACT_EMAIL', email)
    const { contactEmail, contactHref } = await import('../src/lib/contact')

    expect(contactEmail).toBe('advertisers@example.com')
    expect(contactHref).toBe('mailto:advertisers@example.com?subject=Campanie%20publicitar%C4%83')
    expect(new URL(contactHref).searchParams.get('subject')).toBe('Campanie publicitară')
  })

  it.each([undefined, '', '   '])('uses the reserved fallback for %j', async email => {
    vi.stubEnv('VITE_CONTACT_EMAIL', email)
    const { contactEmail, contactHref } = await import('../src/lib/contact')

    expect(contactEmail).toBe('hello@example.com')
    expect(contactHref).toBe('mailto:hello@example.com?subject=Campanie%20publicitar%C4%83')
  })
})
