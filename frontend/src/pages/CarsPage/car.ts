import { maxCarPlateLength, maxCarTextLength, plateKey } from '../../lib/car'
import type { Car, CarInput, CarStatus } from '../../lib/car'

export const carStatusLabels: Record<CarStatus, string> = {
  active: 'Active', maintenance: 'Maintenance', inactive: 'Inactive',
}

export const carStatusTones: Record<CarStatus, string> = {
  active: 'positive', maintenance: 'warning', inactive: 'neutral',
}

export interface CarErrors {
  plate?: string
  makeModel?: string
  driverName?: string
}

export function carErrors(input: CarInput, cars: readonly Car[], editingId?: string): CarErrors {
  const errors: CarErrors = {}
  const key = plateKey(input.plate)
  if (!key) errors.plate = 'Enter a license plate.'
  else if (input.plate.includes('\0') || input.plate.length > maxCarPlateLength) {
    errors.plate = `Use at most ${maxCarPlateLength} characters and no null characters for the license plate.`
  } else if (cars.some((car) => car.id !== editingId && plateKey(car.plate) === key)) {
    errors.plate = 'A car with this license plate already exists.'
  }
  if (!input.makeModel.trim()) errors.makeModel = 'Enter the make and model.'
  else if (input.makeModel.includes('\0') || input.makeModel.length > maxCarTextLength) {
    errors.makeModel = `Use at most ${maxCarTextLength} characters and no null characters for the make/model.`
  }
  if (input.driverName.includes('\0') || input.driverName.length > maxCarTextLength) {
    errors.driverName = `Use at most ${maxCarTextLength} characters and no null characters for the driver name.`
  }
  return errors
}

export function matchesCarSearch(car: Car, search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (!query) return true
  const plateQuery = plateKey(query)
  return (plateQuery.length > 0 && plateKey(car.plate).includes(plateQuery))
    || car.makeModel.toLocaleLowerCase().includes(query)
    || car.driverName.toLocaleLowerCase().includes(query)
}
