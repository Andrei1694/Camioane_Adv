import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import RouteBuilderPage from '../src/pages/RouteBuilderPage/RouteBuilderPage'
import { api, ApiError } from '../src/lib/api'
import { authenticate, renderPage } from './helpers/render'
import { deferred, route } from './helpers/fixtures'

vi.mock('../src/pages/RouteBuilderPage/useRouteMap', async () => ({
  default: (await import('./helpers/unavailableMap')).useUnavailableMap,
}))

beforeEach(() => authenticate())

it('adds and reorders stops through coordinate forms, then saves while the map is unavailable', async () => {
  const saving = deferred<ReturnType<typeof route>>()
  const create = vi.spyOn(api, 'createRoute').mockReturnValue(saving.promise)
  const actor = userEvent.setup()
  await renderPage(<RouteBuilderPage />)
  expect(screen.getByRole('alert')).toHaveTextContent('Map service unavailable')
  expect(screen.getByRole('button', { name: 'Salvează traseul' })).toBeDisabled()
  await actor.type(screen.getByLabelText('Numele traseului'), ' Offline plan ')
  for (const [longitude, latitude] of route().waypoints) {
    await actor.type(screen.getByLabelText('Latitudine'), String(latitude))
    await actor.type(screen.getByLabelText('Longitudine'), String(longitude))
    await actor.click(screen.getByRole('button', { name: 'Adaugă o oprire' }))
  }
  await actor.click(screen.getByRole('button', { name: 'Inversează' }))
  expect(screen.getByRole('button', { name: 'Arată plecare pe hartă' })).toHaveTextContent('44.50000, 26.20000')
  await actor.click(screen.getByRole('button', { name: 'Salvează traseul' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(create).toHaveBeenCalledWith({ name: ' Offline plan ', waypoints: route().waypoints.toReversed() })
  expect(screen.getByLabelText('Numele traseului')).toBeDisabled()
  expect(screen.getByLabelText('Latitudine')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Inversează' })).toBeDisabled()
  await act(async () => saving.resolve(route({ name: 'Offline plan', waypoints: route().waypoints.toReversed() })))
  expect(await screen.findByText('Salvat', { selector: '[role="status"]' })).toBeInTheDocument()
  expect(screen.getByLabelText('Numele traseului')).toHaveValue('Offline plan')
  expect(screen.getByRole('button', { name: 'Exportă GeoJSON' })).toBeDisabled()
})

it('retries the saved library, opens a route, preserves conflicting edits, and explicitly reloads', async () => {
  vi.spyOn(api, 'routes').mockRejectedValueOnce(new ApiError(500, 'Library unavailable'))
    .mockResolvedValue({ routes: [route()], total: 1 })
  vi.spyOn(api, 'route').mockResolvedValueOnce(route()).mockResolvedValue(route({ name: 'Latest route', version: 2 }))
  const update = vi.spyOn(api, 'updateRoute').mockRejectedValue(new ApiError(409, 'Route conflict'))
  const actor = userEvent.setup()
  await renderPage(<RouteBuilderPage />)
  await actor.click(screen.getByRole('button', { name: 'Trasee salvate' }))
  await actor.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  await actor.click(await screen.findByRole('button', { name: 'Deschide Test route' }))
  await waitFor(() => expect(screen.getByLabelText('Numele traseului')).toHaveValue('Test route'))
  await actor.clear(screen.getByLabelText('Numele traseului'))
  await actor.type(screen.getByLabelText('Numele traseului'), 'My route')
  await actor.click(screen.getByRole('button', { name: 'Salvează traseul' }))
  await screen.findByRole('button', { name: 'Reîncarcă traseul' })
  expect(screen.getByLabelText('Numele traseului')).toHaveValue('My route')
  expect(update).toHaveBeenCalledWith(route().id, { name: 'My route', waypoints: route().waypoints, version: 1 })
  await actor.click(screen.getByRole('button', { name: 'Reîncarcă traseul' }))
  await waitFor(() => expect(screen.getByLabelText('Numele traseului')).toHaveValue('Latest route'))
  expect(window.confirm).toHaveBeenCalledWith('Renunți la modificările nesalvate ale acestui traseu?')
  expect(screen.getByRole('button', { name: 'Salvează traseul' })).toBeDisabled()
})
