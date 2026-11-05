// The admin app's formats (frontend/src/lib/format.ts), so a figure reads the same in both.

const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const formatCount = (value: number) => integer.format(value)

/** Hours and car-hours always carry one decimal: 0.5, 3.0. */
export const formatHours = (value: number) => oneDecimal.format(value)

export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatCount(count)} ${count === 1 ? one : many}`
}

/** A time range with an en dash: 16:30–18:00. */
export const formatWindow = (start: string, end: string) => `${start}–${end}`
