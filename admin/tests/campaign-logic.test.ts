import { expect, it, vi } from 'vitest'
import { addDays, addMonths, calendarDays, changedPastDays, dayIsComplete, dayMinutes, hourSelection, intervalErrors, scheduleMinutes, todayInBucharest, validIntervals, weekDay } from '../src/pages/CampaignPage/campaign'
import { campaign, id } from './helpers/fixtures'

it.each([
  ['2026-11-09T21:59:59Z', '2026-11-09'], ['2026-11-09T22:00:00Z', '2026-11-10'],
  ['2026-03-29T00:59:59Z', '2026-03-29'], ['2026-03-29T01:00:00Z', '2026-03-29'],
  ['2026-10-25T00:59:59Z', '2026-10-25'], ['2026-10-25T01:00:00Z', '2026-10-25'],
])('uses Bucharest dates at %s', (now, expected) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(now))
  expect(todayInBucharest()).toBe(expected)
})

it('does calendar arithmetic across leap days, DST and year boundaries', () => {
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  expect(addMonths('2026-12-31', 1)).toBe('2027-01-01')
  expect(weekDay('2026-11-09')).toBe(0)
  expect(calendarDays('2026-11-01')).toHaveLength(42)
  expect(calendarDays('2026-11-01')[0]).toBe('2026-10-26')
})

it('snaps selections to quarter hours and keeps both ends within the day', () => {
  expect(hourSelection(602, 602, false)).toEqual({ start: 600, end: 660 })
  expect(hourSelection(600, 541, true)).toEqual({ start: 540, end: 600 })
  expect(hourSelection(1440, 1440, false)).toEqual({ start: 1425, end: 1440 })
  expect(hourSelection(-20, -10, true)).toEqual({ start: 0, end: 15 })
})

it.each([
  { start: null, end: 60 }, { start: 0, end: null }, { start: -15, end: 60 },
  { start: 1, end: 60 }, { start: 0, end: 61 }, { start: 60, end: 60 }, { start: 0, end: 1455 },
])('rejects incomplete or invalid interval %j', (interval) => {
  expect(intervalErrors([{ id: 'a', ...interval }]).get('a')).toBeDefined()
})

it('allows adjacent intervals but flags both overlapping intervals', () => {
  const first = { id: id(1), start: 0, end: 60 }
  const second = { id: id(2), start: 60, end: 120 }
  expect(intervalErrors([first, second]).size).toBe(0)
  expect(intervalErrors([first, { ...second, start: 45 }]).size).toBe(2)
  expect(intervalErrors([first, { ...first, id: id(2) }]).get(id(1))?.message).toContain('deja')
})

it('totals only valid intervals and detects changes to past days independent of ordering', () => {
  const day = campaign().days[0]
  expect(dayIsComplete(day)).toBe(true)
  expect(dayMinutes(day)).toBe(60)
  expect(scheduleMinutes([day, { ...day, date: '2026-11-13' }])).toBe(120)
  expect(dayIsComplete({ ...day, intervals: [] })).toBe(false)
  expect(validIntervals({ ...day, intervals: [{ id: 'missing', start: null, end: null }, ...day.intervals] })).toEqual(day.intervals)
  expect(changedPastDays([day], [day], '2026-11-13')).toBe(false)
  expect(changedPastDays([], [day], '2026-11-13')).toBe(true)
  expect(changedPastDays([], [day], '2026-11-11')).toBe(false)
})
