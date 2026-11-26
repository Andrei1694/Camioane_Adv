import { expect, it, vi } from 'vitest'
import { exportRoute, formatDistance, formatDuration, loadDraft, readRoute, saveDraft, stopLabel } from '../src/pages/RouteBuilderPage/route'
import { route, user } from './helpers/fixtures'

it('restores names, stops and saved comparison snapshots only for their owner', () => {
  const draft = { name: 'Edited', waypoints: route().waypoints, saved: route() }
  saveDraft(user().id, draft)
  expect(loadDraft(user().id)).toEqual(draft)
  expect(loadDraft('other-user')).toEqual({ name: '', waypoints: [], saved: null })
  saveDraft(user().id, { name: '', waypoints: [], saved: null })
  expect(sessionStorage.getItem('camioane.route-draft.v1')).toBeNull()
})

it('restores legacy waypoint-only drafts and rejects corrupted storage', () => {
  sessionStorage.setItem('camioane.route-draft.v1', JSON.stringify({ userId: user().id, waypoints: route().waypoints }))
  expect(loadDraft(user().id)).toEqual({ name: '', waypoints: route().waypoints, saved: null })
  sessionStorage.setItem('camioane.route-draft.v1', '{broken')
  expect(loadDraft(user().id).waypoints).toEqual([])
  sessionStorage.setItem('camioane.route-draft.v1', JSON.stringify({ userId: user().id, waypoints: [[999, 44]] }))
  expect(loadDraft(user().id).waypoints).toEqual([])
})

it('tolerates unavailable storage without throwing', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full') })
  expect(loadDraft(user().id).waypoints).toEqual([])
  expect(() => saveDraft(user().id, { name: 'Draft', waypoints: [], saved: null })).not.toThrow()
})

it('validates routing responses and formats distances, times and stop names', () => {
  const valid = { geometry: { coordinates: route().waypoints }, distance: 1500, duration: 90 }
  const input = valid as unknown as Parameters<typeof readRoute>[0]
  expect(readRoute(input)).toEqual({ coordinates: route().waypoints, distance: 1500, duration: 90 })
  expect(readRoute(undefined)).toBeNull()
  expect(readRoute({ ...input!, distance: -1 })).toBeNull()
  expect(formatDistance(1500)).toBe('1,5 km')
  expect([0, 5, 3660].map(formatDuration)).toEqual(['0 min', '< 1 min', '1 h 1 min'])
  expect([0, 1, 2].map((index) => stopLabel(index, 3))).toEqual(['Plecare', 'Oprire 2', 'Destinație'])
})

it('exports calculated geometry and ordered stop features, then releases the object URL', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  exportRoute({ coordinates: route().waypoints, distance: 1500, duration: 90 }, route().waypoints)
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
  const text = new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })
  const data = JSON.parse(await text)
  expect(data.type).toBe('FeatureCollection')
  expect(data.features[0]).toMatchObject({ geometry: { type: 'LineString', coordinates: route().waypoints }, properties: { distance_metres: 1500, duration_seconds: 90 } })
  expect(data.features.slice(1).map((feature: { properties: { order: number } }) => feature.properties.order)).toEqual([1, 2])
  expect(document.querySelector('a[download]')).toBeNull()
  vi.advanceTimersByTime(1000)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-object')
})
