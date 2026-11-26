import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type { ConfigVariableInput, ConfigVariableUpdate } from '../types/config-variable.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflict = 'This configuration variable changed during editing. Reload the latest configuration variable and try again.';
const publicSelect = {
  id: true, name: true, value: true, description: true, version: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ConfigVariableSelect;

async function requireActor(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { sessionVersion: true, status: true, role: true } });
  if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (user.role.name !== 'ADMIN' || !isRoleValid(user.role)) throw new AppError(403, 'Administrator access is required');
}

async function transaction<T>(actor: SessionIdentity, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await serializable(async (tx) => {
      await requireActor(tx, actor);
      return action(tx);
    }, 'Configuration variables changed during this request. Refresh and try again.');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new AppError(409, 'A configuration variable with this name already exists.');
      if (error.code === 'P2025') throw new AppError(404, 'Configuration variable not found');
    }
    throw error;
  }
}

export function createConfigVariableService() {
  return {
    list(actor: SessionIdentity) {
      return transaction(actor, (tx) => tx.configVariable.findMany({ select: publicSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }] }));
    },
    get(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => {
        const configVariable = await tx.configVariable.findUnique({ where: { id }, select: publicSelect });
        if (!configVariable) throw new AppError(404, 'Configuration variable not found');
        return configVariable;
      });
    },
    create(actor: SessionIdentity, input: ConfigVariableInput) {
      return transaction(actor, (tx) => tx.configVariable.create({ data: input, select: publicSelect }));
    },
    update(actor: SessionIdentity, id: string, input: ConfigVariableUpdate) {
      return transaction(actor, async (tx) => {
        const configVariable = await tx.configVariable.findUnique({ where: { id }, select: { version: true } });
        if (!configVariable) throw new AppError(404, 'Configuration variable not found');
        if (configVariable.version !== input.version) throw new AppError(409, conflict);
        const updated = await tx.configVariable.updateMany({
          where: { id, version: input.version },
          data: { name: input.name, value: input.value, description: input.description, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError(409, conflict);
        return tx.configVariable.findUniqueOrThrow({ where: { id }, select: publicSelect });
      });
    },
    remove(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => { await tx.configVariable.delete({ where: { id } }); });
    },
  };
}

export type ConfigVariableService = ReturnType<typeof createConfigVariableService>;
