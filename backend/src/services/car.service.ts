import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type { CarQuery, CreateCarData, PublicCar, UpdateCarData } from '../types/car.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflictMessage = 'Cars changed during this request. Refresh and try again.';

const carSelect = {
  id: true,
  plate: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  info: { select: { make: true, model: true, year: true } },
} satisfies Prisma.CarSelect;

type SelectedCar = Prisma.CarGetPayload<{ select: typeof carSelect }>;

function publicCar(car: SelectedCar): PublicCar {
  return {
    id: car.id,
    plate: car.plate,
    active: car.active,
    info: car.info,
    createdAt: car.createdAt,
    updatedAt: car.updatedAt,
  };
}

async function requireAdministrator(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { sessionVersion: true, role: true },
  });
  if (!current || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (current.role.name !== 'ADMIN' || !isRoleValid(current.role)) {
    throw new AppError(403, 'Administrator access is required');
  }
}

async function requireCar(tx: Prisma.TransactionClient, id: string) {
  const car = await tx.car.findUnique({ where: { id }, select: { id: true } });
  if (!car) throw new AppError(404, 'Car not found');
}

// Runs a car write; the unique plate index is the backstop for duplicates,
// including ones written by a concurrent request.
async function write<T>(action: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await serializable(action, conflictMessage);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'A car with this plate already exists');
    }
    throw error;
  }
}

export function listCars(actor: SessionIdentity, query: CarQuery) {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    const cars = await tx.car.findMany({
      select: carSelect,
      orderBy: { plate: 'asc' },
      take: query.limit,
      skip: query.offset,
    });
    const total = await tx.car.count();
    return { cars: cars.map(publicCar), total };
  }, conflictMessage);
}

export function getCar(actor: SessionIdentity, id: string): Promise<PublicCar> {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    const car = await tx.car.findUnique({ where: { id }, select: carSelect });
    if (!car) throw new AppError(404, 'Car not found');
    return publicCar(car);
  }, conflictMessage);
}

export function createCar(actor: SessionIdentity, data: CreateCarData): Promise<PublicCar> {
  return write(async (tx) => {
    await requireAdministrator(tx, actor);
    return publicCar(await tx.car.create({
      data: {
        plate: data.plate,
        active: data.active,
        ...(data.info === null ? {} : { info: { create: data.info } }),
      },
      select: carSelect,
    }));
  });
}

export function updateCar(actor: SessionIdentity, id: string, data: UpdateCarData): Promise<PublicCar> {
  return write(async (tx) => {
    await requireAdministrator(tx, actor);
    await requireCar(tx, id);
    // deleteMany keeps removing details idempotent when the car has none.
    if (data.info === null) await tx.carInfo.deleteMany({ where: { carId: id } });
    return publicCar(await tx.car.update({
      where: { id },
      data: {
        plate: data.plate,
        active: data.active,
        // Set explicitly so a change to the details alone still counts as an update.
        updatedAt: new Date(),
        ...(data.info ? { info: { upsert: { create: data.info, update: data.info } } } : {}),
      },
      select: carSelect,
    }));
  });
}

export function deleteCar(actor: SessionIdentity, id: string) {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    await requireCar(tx, id);
    // The details row is removed by ON DELETE CASCADE.
    await tx.car.delete({ where: { id } });
  }, conflictMessage);
}
