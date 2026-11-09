import { describe, expect, it } from 'vitest'
import { formatCount, formatHours, formatWindow, plural } from '../src/lib/format'

describe('Romanian formatting', () => {
  it.each([
    [0, '0'],
    [1234, '1.234'],
    [1234567, '1.234.567'],
    [12.4, '12'],
    [12.6, '13'],
  ])('formats the count %s as %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected)
  })

  it.each([
    [0, '0,0'],
    [0.5, '0,5'],
    [3, '3,0'],
    [1.25, '1,3'],
    [1234.5, '1.234,5'],
  ])('formats %s hours as %s', (value, expected) => {
    expect(formatHours(value)).toBe(expected)
  })

  it.each([
    [0, '0 mașini'],
    [1, '1 mașină'],
    [2, '2 mașini'],
    [19, '19 mașini'],
    [20, '20 de mașini'],
    [100, '100 de mașini'],
    [101, '101 mașini'],
  ])('uses the appropriate noun form for %i cars', (count, expected) => {
    expect(plural(count, 'mașină', 'mașini')).toBe(expected)
  })

  it('uses the caller’s supplied singular and plural nouns', () => {
    expect(plural(1, 'credit', 'credite')).toBe('1 credit')
    expect(plural(2, 'credit', 'credite')).toBe('2 credite')
    expect(plural(30, 'credit', 'credite')).toBe('30 de credite')
  })

  it('joins times with an en dash and preserves leading zeros', () => {
    expect(formatWindow('09:05', '10:00')).toBe('09:05–10:00')
  })
})
