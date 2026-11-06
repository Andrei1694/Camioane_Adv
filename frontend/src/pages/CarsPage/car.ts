import { maxCarPlateLength, maxCarTextLength, plateKey } from '../../lib/car'
import type { Car, CarInput, CarStatus } from '../../lib/car'

export const carStatusLabels: Record<CarStatus, string> = {
  active: 'Activă', maintenance: 'În mentenanță', inactive: 'Inactivă',
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
  if (!key) errors.plate = 'Introdu un număr de înmatriculare.'
  else if (input.plate.includes('\0') || input.plate.length > maxCarPlateLength) {
    errors.plate = `Folosește cel mult ${maxCarPlateLength} de caractere, fără caractere nule, pentru numărul de înmatriculare.`
  } else if (cars.some((car) => car.id !== editingId && plateKey(car.plate) === key)) {
    errors.plate = 'Există deja o mașină cu acest număr de înmatriculare.'
  }
  if (!input.makeModel.trim()) errors.makeModel = 'Introdu marca și modelul.'
  else if (input.makeModel.includes('\0') || input.makeModel.length > maxCarTextLength) {
    errors.makeModel = `Folosește cel mult ${maxCarTextLength} de caractere, fără caractere nule, pentru marcă/model.`
  }
  if (input.driverName.includes('\0') || input.driverName.length > maxCarTextLength) {
    errors.driverName = `Folosește cel mult ${maxCarTextLength} de caractere, fără caractere nule, pentru numele șoferului.`
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
