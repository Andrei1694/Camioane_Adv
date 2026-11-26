import type { Prisma } from '../generated/prisma/client.ts';
import { requireSelfOrAdministrator } from '../lib/access.ts';
import { AppError } from '../lib/app-error.ts';
import { serializable } from '../lib/transaction.ts';
import type { BillingData, PublicBilling } from '../types/billing.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflictMessage = 'Billing details changed during this request. Try again.';
const publicSelect = {
  companyName: true, cui: true, address: true, email: true, updatedAt: true,
} satisfies Prisma.UserBillingSelect;

async function loadBilling(tx: Prisma.TransactionClient, actor: SessionIdentity, userId: string) {
  await requireSelfOrAdministrator(tx, actor, userId);
  const user = await tx.user.findUnique({ where: { id: userId }, select: { billing: { select: publicSelect } } });
  if (!user) throw new AppError(404, 'User not found');
  return user.billing;
}

export async function getBilling(actor: SessionIdentity, userId: string): Promise<PublicBilling | null> {
  return serializable((tx) => loadBilling(tx, actor, userId), conflictMessage);
}

export async function saveBilling(actor: SessionIdentity, userId: string, data: BillingData): Promise<PublicBilling> {
  return serializable(async (tx) => {
    await loadBilling(tx, actor, userId);
    return tx.userBilling.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: publicSelect,
    });
  }, conflictMessage);
}

export async function removeBilling(actor: SessionIdentity, userId: string): Promise<void> {
  await serializable(async (tx) => {
    await loadBilling(tx, actor, userId);
    await tx.userBilling.deleteMany({ where: { userId } });
  }, conflictMessage);
}
