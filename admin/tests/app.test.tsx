import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import App from '../src/App'
import { api } from '../src/lib/api'
import { useSession } from '../src/auth/session'
import { authenticate } from './helpers/render'
import { user } from './helpers/fixtures'

it('routes a verified account through the dashboard and profile, then returns to login on sign-out', async () => {
  authenticate()
  vi.spyOn(api, 'me').mockResolvedValue(user())
  vi.spyOn(api, 'users').mockResolvedValue([user()])
  const actor = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Panou de control', level: 1 })).toBeInTheDocument()
  const sidebar = () => within(screen.getByRole('complementary', { name: 'Bară laterală' }))
  await actor.click(sidebar().getByRole('link', { name: 'Profil' }))
  expect(await screen.findByRole('heading', { name: 'Profil', level: 1 })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/profile')
  expect(screen.getByRole('main')).toHaveTextContent(user().email)
  await actor.click(sidebar().getByRole('button', { name: 'Deconectare' }))
  expect(await screen.findByRole('heading', { name: 'Autentificare', level: 1 })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(useSession.getState().session).toBeNull()
})
