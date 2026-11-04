// A car as the Add car page records it. The backend has no fleet API yet, so these limits are
// the page's own; when an API exists, mirror its validation here and keep the API as the authority.

export interface Car {
  /** Upper case, groups split by single spaces: "B 101 CMN". */
  plate: string
  /** Empty when not given. */
  model: string
  /** The account with the Driver role that drives it, if any. */
  driverId: string | null
}

export const plateMaxCharacters = 10
export const modelMaxLength = 60

/** "b-101  cmn " becomes "B 101 CMN": upper case, with each run of spaces or hyphens as one space. */
export function normalizePlate(plate: string) {
  return plate.toUpperCase().replace(/[\s-]+/g, ' ').trim()
}

/** The plate without spaces, so "B 101 CMN" and "B101CMN" count as the same car. */
export function plateKey(plate: string) {
  return plate.replaceAll(' ', '')
}

/** Checks a normalized plate, including against the cars already added. */
export function getPlateError(plate: string, cars: readonly Car[]): string | undefined {
  if (!plate) return 'Enter the car\'s plate.'
  if (!/^[A-Z0-9 ]+$/.test(plate)) return 'Use only the letters A–Z, digits and spaces.'
  const length = plateKey(plate).length
  if (length < 2 || length > plateMaxCharacters) return `Use 2–${plateMaxCharacters} letters and digits.`
  const existing = cars.find((car) => plateKey(car.plate) === plateKey(plate))
  if (existing) return `You've already added ${existing.plate}.`
}

export function normalizeModel(model: string) {
  return model.replace(/\s+/g, ' ').trim()
}

export function getModelError(model: string): string | undefined {
  if (Array.from(model).length > modelMaxLength) return `Use ${modelMaxLength} characters or fewer.`
}
