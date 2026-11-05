// The business plan's worked example (BUSINESS_PLAN.md §7.2). Its rates only show the arithmetic;
// they are not a price list. Every figure on the page is computed here from these rows.

export type RateBand = { start: string, end: string, rate: number }

export const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Cost of one slot: cars × the sum of (hours in each rate band × that band's rate). */
export function priceSlot(cars: number, bands: RateBand[]) {
  const rows = bands.map(band => {
    const hours = (minutesOf(band.end) - minutesOf(band.start)) / 60
    return { ...band, hours, credits: cars * hours * band.rate }
  })
  const hours = rows.reduce((total, row) => total + row.hours, 0)
  return {
    cars,
    rows,
    start: bands[0].start,
    end: bands[bands.length - 1].end,
    hours,
    carHours: cars * hours,
    credits: rows.reduce((total, row) => total + row.credits, 0),
  }
}

export type PricedSlot = ReturnType<typeof priceSlot>

export const exampleSlot = priceSlot(2, [
  { start: '16:30', end: '17:00', rate: 20 },
  { start: '17:00', end: '18:00', rate: 30 },
])
