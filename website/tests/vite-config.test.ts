import { describe, expect, it, vi } from 'vitest'
import { loadEnv } from 'vite'
import config from '../vite.config'

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  loadEnv: vi.fn(),
}))

function configure(command: 'build' | 'serve') {
  if (typeof config !== 'function') throw new Error('Expected the website’s configuration factory')
  return config({ command, mode: command === 'build' ? 'production' : 'development' })
}

describe('build contact-address requirement', () => {
  it.each([undefined, '', '   ', 'missing-at', 'a@', '@example.com', 'a@@example.com', 'a b@example.com'])('rejects %j in production builds', email => {
    vi.mocked(loadEnv).mockReturnValue(email === undefined ? {} : { VITE_CONTACT_EMAIL: email })

    expect(() => configure('build')).toThrow('Set VITE_CONTACT_EMAIL')
    expect(loadEnv).toHaveBeenCalledWith('production', process.cwd(), 'VITE_')
  })

  it.each(['campaign@example.com', '  campaign@example.com  '])('accepts %j in production builds', email => {
    vi.mocked(loadEnv).mockReturnValue({ VITE_CONTACT_EMAIL: email })

    expect(() => configure('build')).not.toThrow()
  })

  it('allows development to use the reserved fallback', () => {
    vi.mocked(loadEnv).mockReturnValue({})

    expect(() => configure('serve')).not.toThrow()
    expect(loadEnv).toHaveBeenCalledWith('development', process.cwd(), 'VITE_')
  })
})
