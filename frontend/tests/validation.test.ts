import { describe, expect, it } from 'vitest'
import { avatarFileError, avatarMaxBytes, getEmailError, getPasswordError, isRole, normalizeEmail, roles } from '../src/lib/user'
import { acceptedFileTypes, declaredTypeError, fileKind, fileTypeLabel } from '../src/lib/file'
import { isCarRouteId, isCarStatus, normalizeCar, plateKey } from '../src/lib/car'
import { carErrors, matchesCarSearch } from '../src/pages/CarsPage/car'
import { isCoordinate, isSavedRoute, routeInputError } from '../src/lib/route'
import { isCampaignSchedule } from '../src/lib/campaign'
import { car, campaign, route } from './helpers/fixtures'

describe('account validation', () => {
  it('normalizes email and accepts every supported role only', () => {
    expect(normalizeEmail('  Test@Example.COM ')).toBe('test@example.com')
    for (const role of roles) expect(isRole(role)).toBe(true)
    for (const role of ['admin', '', null, {}]) expect(isRole(role)).toBe(false)
  })
  it.each(['', 'missing-at.test', 'a@b', 'two@@example.test', 'a b@example.test', `${'a'.repeat(250)}@x.test`])('rejects invalid email %s', (email) => {
    expect(getEmailError(email)).toBeTruthy()
  })
  it('accepts a valid email and the maximum email length', () => {
    expect(getEmailError('a@example.test')).toBeUndefined()
    expect(getEmailError(`${'a'.repeat(247)}@x.test`)).toBeUndefined()
  })
  it.each([11, 12, 128, 129])('counts Unicode password characters at length %i', (length) => {
    expect(Boolean(getPasswordError('🔒'.repeat(length)))).toBe(length < 12 || length > 128)
  })
  it('preserves spaces in password length', () => expect(getPasswordError(' '.repeat(12))).toBeUndefined())
})

describe('file validation', () => {
  it.each(acceptedFileTypes)('allows %s for files', (type) => {
    expect(declaredTypeError(new File(['x'], 'test', { type }))).toBeUndefined()
  })
  it('rejects empty and unsupported files while leaving unknown types to the API', () => {
    expect(declaredTypeError(new File([], 'empty'))).toContain('gol')
    expect(declaredTypeError(new File(['x'], 'test.txt', { type: 'text/plain' }))).toBeTruthy()
    expect(declaredTypeError(new File(['x'], 'unknown'))).toBeUndefined()
    expect(fileTypeLabel('image/png')).toBe('Imagine PNG')
    expect(fileTypeLabel('test/type')).toBe('test/type')
    expect(['image/png', 'video/mp4', 'text/plain'].map(fileKind)).toEqual(['image', 'video', 'other'])
  })
  it('enforces avatar types and the inclusive 10 MiB boundary', () => {
    expect(avatarFileError(new File([], 'empty.png'))).toBeTruthy()
    expect(avatarFileError(new File(['x'], 'video.mp4', { type: 'video/mp4' }))).toBeTruthy()
    const picture = new File(['x'], 'picture.png', { type: 'image/png' })
    Object.defineProperty(picture, 'size', { configurable: true, value: avatarMaxBytes })
    expect(avatarFileError(picture)).toBeUndefined()
    Object.defineProperty(picture, 'size', { value: avatarMaxBytes + 1 })
    expect(avatarFileError(picture)).toContain('depășește')
  })
})

describe('cars', () => {
  it('normalizes without changing identity and detects equivalent plates', () => {
    expect(normalizeCar(car({ plate: ' b-01-test ', makeModel: ' Van ', driverName: ' Driver ' })))
      .toMatchObject({ plate: 'B-01-TEST', makeModel: 'Van', driverName: 'Driver' })
    expect(plateKey(' b-01 test ')).toBe('B01TEST')
    expect(carErrors(car({ plate: 'b-01-test' }), [car()]).plate).toContain('deja')
    expect(carErrors(car(), [car()], car().id)).toEqual({})
  })
  it('validates required fields, text limits and null characters', () => {
    expect(carErrors(car({ plate: ' - ', makeModel: ' ', driverName: 'x'.repeat(201) }), [])).toEqual({
      plate: expect.any(String), makeModel: expect.any(String), driverName: expect.any(String),
    })
    for (const field of ['plate', 'makeModel', 'driverName'] as const) {
      expect(carErrors(car({ [field]: 'bad\0value' }), [])[field]).toBeTruthy()
    }
    expect(carErrors(car({ plate: 'x'.repeat(33) }), []).plate).toBeTruthy()
    expect(carErrors(car({ makeModel: 'x'.repeat(201) }), []).makeModel).toBeTruthy()
    expect(carErrors(car({ driverName: '' }), [])).toEqual({})
    expect(isCarRouteId('centru')).toBe(true)
    expect(isCarRouteId('custom')).toBe(false)
    expect(isCarStatus('maintenance')).toBe(true)
    expect(isCarStatus('online')).toBe(false)
  })
  it.each(['', ' b01 ', 'VAN', 'driver'])('searches plate, model and driver: %s', (query) => {
    expect(matchesCarSearch(car(), query)).toBe(true)
    expect(matchesCarSearch(car(), 'unmatched')).toBe(false)
  })
})

describe('routes and schedules', () => {
  it.each([[180, 85.051129], [-180, -85.051129], [0, 0]])('accepts map coordinate boundary %j', (longitude, latitude) => {
    expect(isCoordinate([longitude, latitude])).toBe(true)
  })
  it.each([null, [], [0], [0, 0, 0], [181, 0], [0, 86], [NaN, 0], [0, Infinity], ['1', 2]])('rejects malformed coordinate %j', (point) => {
    expect(isCoordinate(point)).toBe(false)
  })
  it('validates route name, stop count and stored version', () => {
    expect(routeInputError(route())).toBe('')
    for (const name of ['', ' ', 'x'.repeat(201), 'bad\0name']) expect(routeInputError(route({ name }))).toBeTruthy()
    for (const count of [0, 1, 101]) expect(routeInputError(route({ waypoints: Array.from({ length: count }, () => [26, 44]) }))).toBeTruthy()
    expect(routeInputError(route({ waypoints: Array.from({ length: 100 }, () => [26, 44]) }))).toBe('')
    expect(isSavedRoute(route())).toBe(true)
    for (const changed of [{ version: 0 }, { name: ' untrimmed ' }, { id: 'bad' }, { createdAt: 'bad' }]) {
      expect(isSavedRoute({ ...route(), ...changed })).toBe(false)
    }
  })
  it('rejects impossible dates, unsorted days, overlapping intervals and duplicate IDs', () => {
    const days = campaign().days
    expect(isCampaignSchedule(days)).toBe(true)
    expect(isCampaignSchedule([])).toBe(false)
    expect(isCampaignSchedule([{ ...days[0], date: '2026-02-30' }])).toBe(false)
    expect(isCampaignSchedule([...days, ...days])).toBe(false)
    expect(isCampaignSchedule([{ ...days[0], intervals: [...days[0].intervals, ...days[0].intervals] }])).toBe(false)
    expect(isCampaignSchedule([{ ...days[0], intervals: [{ ...days[0].intervals[0], start: 601 }] }])).toBe(false)
  })
})
