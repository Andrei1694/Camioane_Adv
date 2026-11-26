import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import CampaignPage from '../src/pages/CampaignPage/CampaignPage'
import CampaignCreator from '../src/pages/CampaignPage/components/CampaignCreator'
import { formatDay } from '../src/pages/CampaignPage/campaign'
import { api, ApiError } from '../src/lib/api'
import { authenticate, renderPage } from './helpers/render'
import { campaign, deferred } from './helpers/fixtures'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
  authenticate()
})

it('loads, retries and paginates saved campaigns', async () => {
  const list = vi.spyOn(api, 'campaigns').mockRejectedValueOnce(new ApiError(0, 'Offline'))
    .mockResolvedValueOnce({ campaigns: [campaign()], total: 51 }).mockResolvedValue({ campaigns: [], total: 0 })
  await renderPage(<CampaignPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await screen.findByRole('rowheader', { name: 'Test campaign' })
  await userEvent.click(screen.getByRole('button', { name: 'Următor' }))
  await waitFor(() => expect(list).toHaveBeenCalledWith({ limit: 50, offset: 50 }, expect.any(AbortSignal)))
  expect(await screen.findByText(/Nu există încă nicio campanie/)).toBeInTheDocument()
})

it('creates a draft through date selection, interval editing and review', async () => {
  const create = vi.spyOn(api, 'createCampaign').mockResolvedValue(campaign())
  const onComplete = vi.fn().mockResolvedValue(undefined)
  const actor = userEvent.setup()
  await renderPage(<CampaignCreator onComplete={onComplete} onCancel={vi.fn()} onReload={vi.fn()} reloading={false} />)
  await actor.click(screen.getByRole('button', { name: /Stabilește orele/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Selectează cel puțin o zi')
  await actor.type(screen.getByLabelText(/Numele campaniei/), 'New campaign')
  await actor.click(screen.getByRole('button', { name: new RegExp(formatDay('2026-11-12').replaceAll('.', '\\.')) }))
  await actor.click(screen.getByRole('button', { name: /Stabilește orele/ }))
  await actor.click(screen.getByRole('button', { name: /Adaugă un interval/ }))
  await actor.selectOptions(screen.getByLabelText('Ora de început pentru intervalul 1'), '600')
  await actor.selectOptions(screen.getByLabelText('Ora de sfârșit pentru intervalul 1'), '660')
  await actor.click(screen.getByRole('button', { name: 'Verifică campania' }))
  await actor.click(screen.getByRole('button', { name: 'Salvează schița' }))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(campaign()))
  expect(create.mock.calls[0][0]).toEqual({ name: 'New campaign', days: [{ date: '2026-11-12', intervals: [{ id: expect.any(String), start: 600, end: 660 }] }] })
})

it('preserves a conflicting editor until the user explicitly reloads', async () => {
  vi.spyOn(api, 'campaigns').mockResolvedValue({ campaigns: [campaign()], total: 1 })
  vi.spyOn(api, 'campaign').mockResolvedValueOnce(campaign()).mockResolvedValue(campaign({ name: 'Latest campaign', version: 2 }))
  const update = vi.spyOn(api, 'updateCampaign').mockRejectedValue(new ApiError(409, 'Conflict'))
  const actor = userEvent.setup()
  await renderPage(<CampaignPage />)
  await actor.click(await screen.findByRole('button', { name: 'Editează Test campaign' }))
  await actor.clear(await screen.findByLabelText(/Numele campaniei/))
  await actor.type(screen.getByLabelText(/Numele campaniei/), 'My campaign')
  await actor.click(screen.getByRole('button', { name: 'Verifică' }))
  await actor.click(screen.getByRole('button', { name: 'Salvează modificările' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Conflict')
  expect(update).toHaveBeenCalledWith(campaign().id, expect.objectContaining({ version: 1, name: 'My campaign' }))
  expect(screen.getByText('My campaign')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: /Renunță la modificări și reîncarcă/ }))
  await waitFor(() => expect(screen.getByLabelText(/Numele campaniei/)).toHaveValue('Latest campaign'))
})

it('keeps past dates and hours read-only while allowing the name to change', async () => {
  const old = campaign({ days: [{ ...campaign().days[0], date: '2026-11-09' }] })
  await renderPage(<CampaignCreator initialCampaign={old} onComplete={vi.fn()} onCancel={vi.fn()} onReload={vi.fn()} reloading={false} />)
  expect(screen.getByRole('button', { name: `Elimină ${formatDay('2026-11-09')}` })).toBeDisabled()
  expect(screen.getByLabelText(/Numele campaniei/)).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: /Stabilește orele/ }))
  expect(screen.getByLabelText('Ora de început pentru intervalul 1')).toBeDisabled()
  expect(screen.getByLabelText('Ora de sfârșit pentru intervalul 1')).toBeDisabled()
  expect(screen.getByRole('button', { name: /Adaugă un interval/ })).toBeDisabled()
})

it('disables repeat saves and retains the draft when the record is missing', async () => {
  const pending = deferred<ReturnType<typeof campaign>>()
  const update = vi.spyOn(api, 'updateCampaign').mockReturnValue(pending.promise)
  await renderPage(<CampaignCreator initialCampaign={campaign()} onComplete={vi.fn()} onCancel={vi.fn()} onReload={vi.fn()} reloading={false} />)
  await userEvent.click(screen.getByRole('button', { name: 'Verifică' }))
  await userEvent.click(screen.getByRole('button', { name: 'Salvează modificările' }))
  expect(await screen.findByRole('button', { name: 'Se salvează…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled()
  await act(async () => pending.reject(new ApiError(404, 'Campania nu a fost găsită')))
  expect(await screen.findByRole('alert')).toHaveTextContent('nu a fost găsită')
  expect(update).toHaveBeenCalledOnce()
  expect(screen.getByText('Test campaign')).toBeInTheDocument()
})
