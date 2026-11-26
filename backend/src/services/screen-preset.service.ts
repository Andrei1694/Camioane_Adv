import { Prisma } from '../generated/prisma/client.ts';
import type { ScreenPreset } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { parseScreenPresetRegions } from '../lib/screen-preset-validation.ts';
import { serializable } from '../lib/transaction.ts';
import type { ScreenPresetInput, ScreenPresetUpdate } from '../types/screen-preset.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflict = 'This screen preset changed during editing. Reload the latest screen preset and try again.';

async function transaction<T>(actor: SessionIdentity, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await serializable(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { sessionVersion: true, status: true, role: true } });
      if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
      if (user.role.name !== 'ADMIN' || !isRoleValid(user.role)) throw new AppError(403, 'Administrator access is required');
      return action(tx);
    }, 'Screen presets changed during this request. Refresh and try again.');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new AppError(404, 'Screen preset not found');
    throw error;
  }
}

function publicScreenPreset(screenPreset: ScreenPreset) {
  try {
    const { id, name, canvasWidth, canvasHeight, regions, version, createdAt, updatedAt } = screenPreset;
    const canvas = { width: canvasWidth, height: canvasHeight };
    return { id, name, canvas, regions: parseScreenPresetRegions(regions, canvas), version, createdAt, updatedAt };
  } catch {
    throw new Error('Invalid stored screen preset layout');
  }
}

function presetData(input: ScreenPresetInput) {
  return { name: input.name, canvasWidth: input.canvas.width, canvasHeight: input.canvas.height, regions: input.regions };
}

export function createScreenPresetService() {
  return {
    list(actor: SessionIdentity) {
      return transaction(actor, async (tx) => (await tx.screenPreset.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })).map(publicScreenPreset));
    },
    get(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => {
        const screenPreset = await tx.screenPreset.findUnique({ where: { id } });
        if (!screenPreset) throw new AppError(404, 'Screen preset not found');
        return publicScreenPreset(screenPreset);
      });
    },
    create(actor: SessionIdentity, input: ScreenPresetInput) {
      return transaction(actor, async (tx) => publicScreenPreset(await tx.screenPreset.create({ data: presetData(input) })));
    },
    update(actor: SessionIdentity, id: string, input: ScreenPresetUpdate) {
      return transaction(actor, async (tx) => {
        const screenPreset = await tx.screenPreset.findUnique({ where: { id }, select: { version: true } });
        if (!screenPreset) throw new AppError(404, 'Screen preset not found');
        if (screenPreset.version !== input.version) throw new AppError(409, conflict);
        const updated = await tx.screenPreset.updateMany({
          where: { id, version: input.version },
          data: { ...presetData(input), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError(409, conflict);
        return publicScreenPreset(await tx.screenPreset.findUniqueOrThrow({ where: { id } }));
      });
    },
    remove(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => { await tx.screenPreset.delete({ where: { id } }); });
    },
  };
}

export type ScreenPresetService = ReturnType<typeof createScreenPresetService>;
