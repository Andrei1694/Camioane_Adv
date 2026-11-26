import type { Prisma } from '../generated/prisma/client.ts';
import type { SessionIdentity } from '../types/user.ts';
import { AppError } from './app-error.ts';
import { isRoleValid } from './role.ts';

// Recheck the session and self-or-admin access inside the caller's transaction.
export async function requireSelfOrAdministrator(tx: Prisma.TransactionClient, actor: SessionIdentity, userId: string) {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { sessionVersion: true, status: true, role: true },
  });
  if (!current || current.status !== 'ACTIVE' || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (userId !== actor.id && (current.role.name !== 'ADMIN' || !isRoleValid(current.role))) {
    throw new AppError(403, 'Administrator access is required');
  }
}
