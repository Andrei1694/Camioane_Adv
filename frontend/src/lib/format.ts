// Formatting shared by more than one page. Page-specific formats stay with their page.

const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// The same day format as the dashboard's formatLongDay, in the browser's time zone.
const localDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const localTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const formatCount = (value: number) => integer.format(value)

export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatCount(count)} ${count === 1 ? one : many}`
}

export const byteUnits = ['B', 'KB', 'MB', 'GB'] as const
export type ByteUnit = typeof byteUnits[number]

/** A byte count in one unit: B and KB whole, MB and GB to one decimal. */
export function byteSizeIn(bytes: number, unit: ByteUnit) {
  const scaled = bytes / 1000 ** byteUnits.indexOf(unit)
  return unit === 'B' || unit === 'KB' ? integer.format(scaled) : oneDecimal.format(scaled)
}

/** File sizes in decimal units, picking the largest unit that keeps the shown value under 1,000. */
export function byteSize(bytes: number): { value: string, unit: ByteUnit } {
  for (const unit of byteUnits) {
    const decimals = unit === 'B' || unit === 'KB' ? 0 : 1
    const shown = Math.round((bytes / 1000 ** byteUnits.indexOf(unit)) * 10 ** decimals) / 10 ** decimals
    if (shown < 1000 || unit === 'GB') return { value: byteSizeIn(bytes, unit), unit }
  }
  return { value: byteSizeIn(bytes, 'GB'), unit: 'GB' }
}

export const formatByteSize = (bytes: number) => {
  const { value, unit } = byteSize(bytes)
  return `${value} ${unit}`
}

export const formatLocalDay = (iso: string) => localDay.format(new Date(iso))
export const formatLocalTime = (iso: string) => localTime.format(new Date(iso))
