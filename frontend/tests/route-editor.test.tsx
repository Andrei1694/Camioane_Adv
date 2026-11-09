import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import useRouteEditor from '../src/pages/RouteBuilderPage/useRouteEditor'
import { api, ApiError } from '../src/lib/api'
import { saveDraft } from '../src/pages/RouteBuilderPage/route'
import { signIn } from '../src/auth/session'
import { authenticate, Providers } from './helpers/render'
import { deferred, route, user } from './helpers/fixtures'
import { mapControls } from './helpers/unavailableMap'

vi.mock('../src/pages/RouteBuilderPage/useRouteMap', async () => ({
  default: (await import('./helpers/unavailableMap')).useUnavailableMap,
}))

beforeEach(() => {
  authenticate()
  vi.spyOn(api, 'routes').mockResolvedValue({ routes: [route()], total: 1 })
})

function editor(saved = false) {
  saveDraft(user().id, { name: route().name, waypoints: route().waypoints, saved: saved ? route() : null })
  return renderHook(() => useRouteEditor(user().id), { wrapper: Providers })
}

it('saves independent of map availability and locks edits while saving', async () => {
  const pending = deferred<ReturnType<typeof route>>()
  const create = vi.spyOn(api, 'createRoute').mockReturnValue(pending.promise)
  const { result } = editor()
  let saving!: Promise<boolean>
  act(() => { saving = result.current.saveRoute() })
  expect(result.current.pending).toContain('Se salvează')
  expect(mapControls.lockEditing).toHaveBeenCalledWith(true)
  await act(async () => { expect(await result.current.saveRoute()).toBe(false) })
  expect(create).toHaveBeenCalledOnce()
  await act(async () => { pending.resolve(route()); await saving })
  expect(result.current.saved).toEqual(route())
  expect(result.current.dirty).toBe(false)
  expect(mapControls.lockEditing).toHaveBeenLastCalledWith(false)
})

it('keeps versioned edits on conflict and replaces them only after confirmed reload', async () => {
  const update = vi.spyOn(api, 'updateRoute').mockRejectedValue(new ApiError(409, 'Conflict'))
  vi.spyOn(api, 'route').mockResolvedValue(route({ name: 'Latest', version: 2 }))
  const { result } = editor(true)
  act(() => result.current.setName('My edits'))
  await act(async () => { await result.current.saveRoute() })
  expect(update).toHaveBeenCalledWith(route().id, expect.objectContaining({ name: 'My edits', version: 1 }))
  expect(result.current).toMatchObject({ name: 'My edits', conflict: true, dirty: true })
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await act(async () => { await result.current.openRoute(route().id) })
  expect(result.current.name).toBe('My edits')
  await act(async () => { await result.current.openRoute(route().id) })
  expect(result.current).toMatchObject({ name: 'Latest', saved: { version: 2 }, conflict: false, dirty: false })
})

it('preserves a deleted route as a new draft and supports save-as-new', async () => {
  vi.spyOn(api, 'updateRoute').mockRejectedValue(new ApiError(404, 'Missing'))
  const create = vi.spyOn(api, 'createRoute').mockResolvedValue(route({ version: 1 }))
  const { result } = editor(true)
  await act(async () => { await result.current.saveRoute() })
  expect(result.current.missing).toBe(true)
  expect(result.current.builder.waypoints).toEqual(route().waypoints)
  await act(async () => { await result.current.saveRoute(true) })
  expect(create).toHaveBeenCalledWith({ name: route().name, waypoints: route().waypoints })
  expect(result.current.missing).toBe(false)
})

it('confirms deletion and retains the current route contents as an unsaved plan', async () => {
  const remove = vi.spyOn(api, 'deleteRoute').mockResolvedValue(undefined)
  const { result } = editor(true)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await act(async () => { await result.current.deleteRoute(route()) })
  expect(remove).not.toHaveBeenCalled()
  await act(async () => { await result.current.deleteRoute(route()) })
  expect(result.current.saved).toBeNull()
  expect(result.current.name).toBe(route().name)
  expect(result.current.builder.waypoints).toEqual(route().waypoints)
  expect(result.current.dirty).toBe(true)
})

it('loads the saved library on demand and refuses invalid saves', async () => {
  const create = vi.spyOn(api, 'createRoute')
  const { result } = editor()
  expect(api.routes).not.toHaveBeenCalled()
  act(() => result.current.setLibraryOpen(true))
  await waitFor(() => expect(result.current.list.data?.routes).toEqual([route()]))
  act(() => result.current.setName(''))
  await act(async () => { await result.current.saveRoute() })
  expect(result.current.failure).toContain('nume de traseu')
  expect(create).not.toHaveBeenCalled()
})

it('ignores save completion after changing accounts or unmounting', async () => {
  const pending = deferred<ReturnType<typeof route>>()
  vi.spyOn(api, 'createRoute').mockReturnValue(pending.promise)
  const { result, unmount } = editor()
  let saving!: Promise<boolean>
  act(() => { saving = result.current.saveRoute() })
  act(() => signIn('other-account', 3600))
  unmount()
  pending.resolve(route())
  await expect(saving).resolves.toBe(false)
})
