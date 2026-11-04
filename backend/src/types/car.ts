import type { Car, CarInfo } from '../generated/prisma/client.ts';

export type CarDetails = Pick<CarInfo, 'make' | 'model' | 'year'>;

export type PublicCar = Pick<Car, 'id' | 'plate' | 'active' | 'createdAt' | 'updatedAt'> & {
  info: CarDetails | null;
};

export interface CreateCarData {
  plate: string;
  active: boolean;
  info: CarDetails | null;
}

/** An info object replaces every detail; null removes them. */
export type UpdateCarData = Partial<CreateCarData>;

export interface CarQuery {
  limit: number;
  offset: number;
}
