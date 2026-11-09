import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import CarsPage from '../src/pages/CarsPage/CarsPage'
import { api, ApiError } from '../src/lib/api'
import { authenticate, renderPage } from './helpers/render'
import { car, deferred, id } from './helpers/fixtures'

beforeEach(() => { authenticate(); vi.spyOn(api, 'cars').mockResolvedValue([car()]) })

it('shows loading, failure, retry and empty fleet states', async () => {
  const pending = deferred<ReturnType<typeof car>[]>()
  vi.mocked(api.cars).mockReturnValueOnce(pending.promise).mockResolvedValue([])
  await renderPage(<CarsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Se încarcă mașinile')
  await act(async () => pending.reject(new ApiError(0, 'Offline')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText(/Nu există încă mașini/)).toBeInTheDocument()
})

it('filters the loaded inventory by plate, route and administrative status', async () => {
  vi.mocked(api.cars).mockResolvedValue([car(), car({ id: id(8), plate: 'CJ 02 TEST', routeId: null, status: 'maintenance' })])
  const actor = userEvent.setup()
  await renderPage(<CarsPage />)
  await screen.findByRole('rowheader', { name: 'B 01 TEST' })
  await actor.type(screen.getByLabelText('Caută mașini'), 'b01')
  expect(screen.queryByRole('rowheader', { name: 'CJ 02 TEST' })).not.toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Resetează filtrele' }))
  await actor.selectOptions(screen.getByLabelText('Traseu'), 'unassigned')
  await actor.selectOptions(screen.getByLabelText('Stare'), 'maintenance')
  expect(screen.getByRole('rowheader', { name: 'CJ 02 TEST' })).toBeInTheDocument()
  expect(screen.queryByRole('rowheader', { name: 'B 01 TEST' })).not.toBeInTheDocument()
  expect(api.cars).toHaveBeenCalledOnce()
})

it('validates and creates a car, clears filters and prevents duplicate pending saves', async () => {
  const pending = deferred<ReturnType<typeof car>>()
  const create = vi.spyOn(api, 'createCar').mockReturnValue(pending.promise)
  const actor = userEvent.setup()
  await renderPage(<CarsPage />)
  await screen.findByRole('rowheader', { name: 'B 01 TEST' })
  await actor.type(screen.getByLabelText('Caută mașini'), 'b01')
  await actor.click(screen.getByRole('button', { name: 'Adaugă o mașină' }))
  await actor.click(screen.getByRole('button', { name: 'Salvează mașina' }))
  expect(create).not.toHaveBeenCalled()
  await actor.type(screen.getByLabelText('Număr de înmatriculare'), ' cj 02 test ')
  await actor.type(screen.getByLabelText('Marcă/model'), ' Van ')
  await actor.click(screen.getByRole('button', { name: 'Salvează mașina' }))
  expect(await screen.findByRole('button', { name: 'Se salvează…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled()
  expect(create.mock.calls[0][0]).toEqual({ plate: 'CJ 02 TEST', makeModel: 'Van', driverName: '', routeId: null, status: 'active' })
  await act(async () => pending.resolve(car({ id: id(8), plate: 'CJ 02 TEST' })))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvează mașina' })).not.toBeInTheDocument())
  expect(screen.getByLabelText('Caută mașini')).toHaveValue('')
})

it('submits the loaded version and preserves edits after conflicts until explicit reload', async () => {
  const update = vi.spyOn(api, 'updateCar').mockRejectedValue(new ApiError(409, 'Conflict'))
  vi.spyOn(api, 'car').mockResolvedValue(car({ makeModel: 'Newest model', version: 2 }))
  const actor = userEvent.setup()
  await renderPage(<CarsPage />)
  await actor.click(await screen.findByRole('button', { name: 'Editează B 01 TEST' }))
  await actor.clear(screen.getByLabelText('Marcă/model'))
  await actor.type(screen.getByLabelText('Marcă/model'), 'My change')
  await actor.click(screen.getByRole('button', { name: 'Salvează modificările' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Conflict')
  expect(update).toHaveBeenCalledWith(car().id, expect.objectContaining({ version: 1, makeModel: 'My change' }))
  expect(screen.getByLabelText('Marcă/model')).toHaveValue('My change')
  await actor.click(screen.getByRole('button', { name: 'Reîncarcă mașina' }))
  await waitFor(() => expect(screen.getByLabelText('Marcă/model')).toHaveValue('Newest model'))
})

it('explains deleted records and prevents further saves', async () => {
  vi.spyOn(api, 'updateCar').mockRejectedValue(new ApiError(404, 'Missing'))
  await renderPage(<CarsPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Editează B 01 TEST' }))
  await userEvent.click(screen.getByRole('button', { name: 'Salvează modificările' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('a fost ștearsă')
  expect(screen.getByRole('button', { name: 'Salvează modificările' })).toBeDisabled()
})

it('requires a named delete dialog and blocks dismissal while deleting', async () => {
  const pending = deferred<undefined>()
  const remove = vi.spyOn(api, 'deleteCar').mockReturnValue(pending.promise)
  await renderPage(<CarsPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Șterge B 01 TEST' }))
  const dialog = screen.getByRole('dialog', { name: 'Ștergi mașina B 01 TEST?' })
  expect(remove).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Șterge mașina' }))
  expect(await within(dialog).findByRole('button', { name: 'Se șterge…' })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Anulează' })).toBeDisabled()
  const cancel = new Event('cancel', { bubbles: false, cancelable: true })
  fireEvent(dialog, cancel)
  expect(cancel.defaultPrevented).toBe(true)
  await act(async () => pending.resolve(undefined))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
