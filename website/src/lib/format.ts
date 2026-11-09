// Romanian formats for the public website; the admin app has its own locale.

const integer = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pluralRules = new Intl.PluralRules('ro-RO')

export const formatCount = (value: number) => integer.format(value)

/** Hours and car-hours always carry one decimal: 0,5, 3,0. */
export const formatHours = (value: number) => oneDecimal.format(value)

/** Integer counts use explicit noun forms: 1 mașină, 2 mașini, 20 de mașini. */
export function plural(count: number, one: string, many: string) {
  const category = pluralRules.select(count)
  const noun = category === 'one' ? one : category === 'few' ? many : `de ${many}`
  return `${formatCount(count)} ${noun}`
}

/** A time range with an en dash: 16:30–18:00. */
export const formatWindow = (start: string, end: string) => `${start}–${end}`
