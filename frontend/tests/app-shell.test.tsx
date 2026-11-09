import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import AppShell from '../src/components/AppShell'
import { useSession } from '../src/auth/session'
import { authenticate, renderPage } from './helpers/render'
import { user } from './helpers/fixtures'

it.each([true, false])('shows management navigation only with verified access: %s', async (canManage) => {
  authenticate()
  await renderPage(<AppShell user={user()} canManage={canManage}><h1>Page</h1></AppShell>)
  const sidebar = within(screen.getByRole('complementary', { name: 'Bară laterală' }))
  expect(Boolean(sidebar.queryByRole('link', { name: 'Mașini' }))).toBe(canManage)
  expect(Boolean(sidebar.queryByRole('link', { name: 'Credite' }))).toBe(canManage)
  expect(sidebar.getByRole('link', { name: 'Profil' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sari la conținut' })).toHaveAttribute('href', '#main-content')
  await userEvent.click(sidebar.getByRole('button', { name: 'Deconectare' }))
  expect(useSession.getState().session).toBeNull()
})

it('opens the navigation with the keyboard and closes it via its control or backdrop', async () => {
  authenticate()
  await renderPage(<AppShell user={user()} canManage><h1>Page</h1></AppShell>)
  const toggle = screen.getByRole('button', { name: 'Deschide navigarea' })
  toggle.focus()
  await userEvent.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: 'Navigare' })
  expect(dialog).toHaveAttribute('open')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Închide navigarea' }))
  expect(dialog).not.toHaveAttribute('open')
  await userEvent.click(toggle)
  fireEvent.click(dialog, { clientX: -1, clientY: -1 })
  expect(dialog).not.toHaveAttribute('open')
})
