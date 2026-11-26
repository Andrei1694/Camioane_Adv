import { expect, it } from 'vitest'
import { byteSize, byteSizeIn, formatByteSize, formatCount, formatDecimal, formatDuration, formatLocalDay, formatLocalTime, formatMoney, formatSignedCount, money, plural } from '../src/lib/format'

it('formats Romanian numbers, signs and plural forms', () => {
  expect(formatCount(1234)).toBe('1.234')
  expect(formatDecimal(12.34)).toBe('12,3')
  expect(formatSignedCount(-1234)).toBe('−1.234')
  expect(formatSignedCount(12)).toBe('+12')
  expect(formatSignedCount(0)).toBe('0')
  expect([1, 2, 20].map((n) => plural(n, 'mașină', 'mașini'))).toEqual(['1 mașină', '2 mașini', '20 de mașini'])
})

it('uses decimal byte units including rounding across unit boundaries', () => {
  expect(byteSize(999)).toEqual({ value: '999', unit: 'B' })
  expect(byteSize(999500)).toEqual({ value: '1,0', unit: 'MB' })
  expect(formatByteSize(1_500_000)).toBe('1,5 MB')
  expect(byteSizeIn(1_250_000_000, 'GB')).toBe('1,3')
  expect(byteSize(1_000_000_000_000).unit).toBe('GB')
})

it('converts minor currency units using each currency precision', () => {
  expect(formatMoney(12345, 'RON')).toBe('123,45 RON')
  expect(money(12345, 'JPY')).toEqual({ value: '12.345', unit: 'JPY' })
  expect(formatMoney(12345, 'KWD')).toBe('12,345 KWD')
})

it('formats local dates, midnight and elapsed durations', () => {
  expect(formatLocalDay('2026-11-10T10:00:00Z')).toContain('2026')
  expect(formatLocalTime('2026-11-09T22:00:00Z')).toBe('00:00')
  expect([-1, 59, 61, 1500].map(formatDuration)).toEqual(['0 min', '59 min', '1 h 1 min', '1 z 1 h'])
})
