// Formatting shared by more than one page. Page-specific formats stay with their page.

const integer = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// The same day format as the dashboard's formatLongDay, in the browser's time zone.
const localDay = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const localTime = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const formatCount = (value: number) => integer.format(value)
export const formatDecimal = (value: number) => oneDecimal.format(value)

const signedInteger = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })

/** A change with its sign, written with a true minus: +1.000, −200. */
export const formatSignedCount = (value: number) => signedInteger.format(value).replace('-', '\u2212')

const pluralRules = new Intl.PluralRules('ro-RO')

export function plural(count: number, one: string, many: string) {
  const form = pluralRules.select(count)
  return `${formatCount(count)} ${form === 'one' ? one : form === 'other' ? `de ${many}` : many}`
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

// Money arrives in minor units; each currency keeps its own number of decimals (EUR 2, JPY 0).
const moneyFormats = new Map<string, { format: Intl.NumberFormat, digits: number }>()

function moneyFormat(currency: string) {
  let entry = moneyFormats.get(currency)
  if (!entry) {
    const digits = new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    entry = { format: new Intl.NumberFormat('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits }), digits }
    moneyFormats.set(currency, entry)
  }
  return entry
}

/** An amount from its minor units, with the currency code as its unit: 1.000,00 + EUR. */
export function money(minor: number, currency: string) {
  const { format, digits } = moneyFormat(currency)
  return { value: format.format(minor / 10 ** digits), unit: currency }
}

export function formatMoney(minor: number, currency: string) {
  const { value, unit } = money(minor, currency)
  return `${value} ${unit}`
}

/** A wait in whole minutes: 2 z 4 h, 22 h 25 min, 5 min. */
export function formatDuration(minutes: number) {
  const mins = Math.max(0, Math.round(minutes))
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days} z ${hours} h`
  return hours > 0 ? `${hours} h ${mins % 60} min` : `${mins} min`
}

export const formatLocalDay = (iso: string) => localDay.format(new Date(iso))
export const formatLocalTime = (iso: string) => localTime.format(new Date(iso))
