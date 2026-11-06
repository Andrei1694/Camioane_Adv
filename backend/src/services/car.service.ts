import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { plateKey } from '../lib/car-validation.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type { CarInput, CarUpdate } from '../types/car.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflict = 'This car changed during editing. Reload the latest car and try again.';
const publicSelect = {
  id: true, plate: true, makeModel: true, driverName: true, routeId: true, status: true,
  version: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CarSelect;

async function requireActor(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { sessionVersion: true, role: true } });
  if (!user || user.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (user.role.name !== 'ADMIN' || !isRoleValid(user.role)) throw new AppError(403, 'Administrator access is required');
}

async function transaction<T>(actor: SessionIdentity, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await serializable(async (tx) => {
      await requireActor(tx, actor);
      return action(tx);
    }, 'Cars changed during this request. Refresh and try again.');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new AppError(409, 'A car with this license plate already exists.');
      if (error.code === 'P2025') throw new AppError(404, 'Car not found');
    }
    throw error;
  }
}

export function createCarService() {
  return {
    list(actor: SessionIdentity) {
      return transaction(actor, (tx) => tx.car.findMany({ select: publicSelect, orderBy: [{ plateKey: 'asc' }, { id: 'asc' }] }));
    },
    get(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => {
        const car = await tx.car.findUnique({ where: { id }, select: publicSelect });
        if (!car) throw new AppError(404, 'Car not found');
        return car;
      });
    },
    create(actor: SessionIdentity, input: CarInput) {
      return transaction(actor, (tx) => tx.car.create({ data: { ...input, plateKey: plateKey(input.plate) }, select: publicSelect }));
    },
    update(actor: SessionIdentity, id: string, input: CarUpdate) {
      return transaction(actor, async (tx) => {
        const car = await tx.car.findUnique({ where: { id }, select: { version: true } });
        if (!car) throw new AppError(404, 'Car not found');
        if (car.version !== input.version) throw new AppError(409, conflict);
        const updated = await tx.car.updateMany({
          where: { id, version: input.version },
          data: { ...input, plateKey: plateKey(input.plate), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError(409, conflict);
        return tx.car.findUniqueOrThrow({ where: { id }, select: publicSelect });
      });
    },
    remove(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => { await tx.car.delete({ where: { id } }); });
    },
  };
}

export type CarService = ReturnType<typeof createCarService>;
