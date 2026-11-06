import type { CarRoute, CarStatus } from '../generated/prisma/client.ts';

export interface CarInput {
  plate: string;
  makeModel: string;
  driverName: string;
  routeId: CarRoute | null;
  status: CarStatus;
}

export interface CarUpdate extends CarInput {
  version: number;
}
