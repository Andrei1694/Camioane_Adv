import type { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type { PublicConfigEntry } from '../types/config.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflictMessage = 'Config changed during this request. Refresh and try again.';
const entrySelect = { key: true, value: true, updatedAt: true } as const;

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

export function listConfig(actor: SessionIdentity): Promise<PublicConfigEntry[]> {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    return tx.appConfig.findMany({ select: entrySelect, orderBy: { key: 'asc' } });
  }, conflictMessage);
}

export function getConfig(actor: SessionIdentity, key: string): Promise<PublicConfigEntry> {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    const entry = await tx.appConfig.findUnique({ where: { key }, select: entrySelect });
    if (!entry) throw new AppError(404, 'Config key not found');
    return entry;
  }, conflictMessage);
}

// Creates or replaces the value. Under serializable isolation, two requests
// creating the same key conflict and are retried rather than both inserting.
export function setConfig(
  actor: SessionIdentity,
  key: string,
  value: Prisma.InputJsonValue,
): Promise<{ entry: PublicConfigEntry; created: boolean }> {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    const existing = await tx.appConfig.findUnique({ where: { key }, select: { key: true } });
    const entry = existing
      ? await tx.appConfig.update({ where: { key }, data: { value }, select: entrySelect })
      : await tx.appConfig.create({ data: { key, value }, select: entrySelect });
    return { entry, created: !existing };
  }, conflictMessage);
}

export function deleteConfig(actor: SessionIdentity, key: string): Promise<void> {
  return serializable(async (tx) => {
    await requireAdministrator(tx, actor);
    const { count } = await tx.appConfig.deleteMany({ where: { key } });
    if (count === 0) throw new AppError(404, 'Config key not found');
  }, conflictMessage);
}
