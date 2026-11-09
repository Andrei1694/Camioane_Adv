import { describe, expect, it } from 'vitest'
import { exampleSlot, minutesOf, priceSlot } from '../src/lib/pricing'
import type { RateBand } from '../src/lib/pricing'

describe('minutesOf', () => {
  it.each([
    ['00:00', 0],
    ['00:15', 15],
    ['09:05', 545],
    ['16:30', 990],
    ['23:59', 1439],
  ])('converts %s to %i minutes', (time, minutes) => {
    expect(minutesOf(time)).toBe(minutes)
  })
})

describe('priceSlot', () => {
  it('prices a single rate band', () => {
    expect(priceSlot(3, [{ start: '09:00', end: '11:00', rate: 12 }])).toEqual({
      cars: 3,
      start: '09:00',
      end: '11:00',
      hours: 2,
      carHours: 6,
      credits: 72,
      rows: [{ start: '09:00', end: '11:00', rate: 12, hours: 2, credits: 72 }],
    })
  })

  it('adds fractional-hour bands at their individual rates', () => {
    const result = priceSlot(2, [
      { start: '10:00', end: '10:15', rate: 10 },
      { start: '10:15', end: '11:00', rate: 20 },
      { start: '11:00', end: '11:30', rate: 30 },
    ])

    expect(result.rows.map(row => row.hours)).toEqual([0.25, 0.75, 0.5])
    expect(result.rows.map(row => row.credits)).toEqual([5, 30, 30])
    expect(result).toMatchObject({ start: '10:00', end: '11:30', hours: 1.5, carHours: 3, credits: 65 })
  })

  it.each([
    [1, 0.25, 4],
    [2, 0.5, 8],
    [5, 1.25, 20],
  ])('scales costs for %i cars without changing elapsed hours', (cars, carHours, credits) => {
    expect(priceSlot(cars, [{ start: '12:00', end: '12:15', rate: 16 }])).toMatchObject({
      cars, hours: 0.25, carHours, credits,
    })
  })

  it('does not change the supplied rate bands', () => {
    const bands: RateBand[] = [{ start: '08:00', end: '09:00', rate: 15 }]
    const original = structuredClone(bands)
    const result = priceSlot(2, bands)

    expect(bands).toEqual(original)
    expect(result.rows[0]).not.toBe(bands[0])
  })

  it('matches the independently documented business-plan example', () => {
    expect(exampleSlot).toEqual({
      cars: 2,
      start: '16:30',
      end: '18:00',
      hours: 1.5,
      carHours: 3,
      credits: 80,
      rows: [
        { start: '16:30', end: '17:00', rate: 20, hours: 0.5, credits: 20 },
        { start: '17:00', end: '18:00', rate: 30, hours: 1, credits: 60 },
      ],
    })
  })
})
