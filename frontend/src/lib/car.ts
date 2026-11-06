export const carRoutes = [
  { id: 'centru', name: 'Centru' },
  { id: 'nord', name: 'Nord' },
  { id: 'vest', name: 'Vest' },
  { id: 'est', name: 'Est' },
  { id: 'sud', name: 'Sud' },
] as const

export type CarRouteId = typeof carRoutes[number]['id']
export const carStatuses = ['active', 'maintenance', 'inactive'] as const
export type CarStatus = typeof carStatuses[number]
export const maxCarPlateLength = 32
export const maxCarTextLength = 200

export interface CarInput {
  plate: string
  makeModel: string
  driverName: string
  routeId: CarRouteId | null
  status: CarStatus
}

export interface Car extends CarInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export function carsKey(revision: number) {
  return ['cars', revision] as const
}

export function isCarRouteId(value: unknown): value is CarRouteId {
  return carRoutes.some((route) => route.id === value)
}

export function isCarStatus(value: unknown): value is CarStatus {
  return carStatuses.some((status) => status === value)
}

export function plateKey(plate: string) {
  return plate.toUpperCase().replace(/[\s-]/g, '')
}

export function normalizeCar(input: CarInput): CarInput {
  return {
    ...input,
    plate: input.plate.trim().toUpperCase(),
    makeModel: input.makeModel.trim(),
    driverName: input.driverName.trim(),
  }
}
