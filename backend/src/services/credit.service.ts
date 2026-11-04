import { Prisma } from '../generated/prisma/client.ts';
import type { CreditPurchase, CreditTransaction } from '../generated/prisma/client.ts';
import type { CreditConfig } from '../config/credits.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type {
  AdjustmentData,
  ConfirmPurchaseData,
  CreatePurchaseData,
  CreditBalance,
  CreditChange,
  CreditQuery,
  PublicCreditPurchase,
  PublicCreditTransaction,
} from '../types/credit.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflictMessage = 'Credits changed during this request. Refresh and try again.';
const maxBalance = 2147483647;
const manualProvider = 'manual';

interface Actor {
  id: string;
  admin: boolean;
}

function publicPurchase(purchase: CreditPurchase): PublicCreditPurchase {
  return {
    id: purchase.id,
    userId: purchase.userId,
    credits: purchase.credits,
    unitPriceMinor: purchase.unitPriceMinor,
    amountMinor: purchase.amountMinor,
    currency: purchase.currency,
    status: purchase.status,
    reference: purchase.providerPaymentId,
    createdAt: purchase.createdAt,
    settledAt: purchase.settledAt,
  };
}

function publicTransaction(transaction: CreditTransaction): PublicCreditTransaction {
  return {
    id: transaction.id,
    userId: transaction.userId,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    type: transaction.type,
    purchaseId: transaction.purchaseId,
    note: transaction.note,
    createdAt: transaction.createdAt,
  };
}

// Applies one ledger movement and updates the cached balance. Call it only inside
// a transaction that also records the reason for the movement (a purchase, a
// campaign confirmation, an adjustment), so both commit or neither does. The
// guarded increment cannot overdraw the balance even under concurrent callers.
export async function applyCreditChange(tx: Prisma.TransactionClient, change: CreditChange) {
  const updated = await tx.user.updateMany({
    where: {
      id: change.userId,
      creditBalance: { gte: Math.max(0, -change.amount), lte: maxBalance - Math.max(0, change.amount) },
    },
    data: { creditBalance: { increment: change.amount } },
  });
  if (updated.count === 0) {
    const user = await tx.user.findUnique({ where: { id: change.userId }, select: { id: true } });
    if (!user) throw new AppError(404, 'User not found');
    if (change.amount < 0) throw new AppError(409, 'Insufficient credits');
    throw new AppError(409, 'The credit balance would exceed its maximum');
  }
  const { creditBalance } = await tx.user.findUniqueOrThrow({
    where: { id: change.userId },
    select: { creditBalance: true },
  });
  return tx.creditTransaction.create({
    data: {
      userId: change.userId,
      amount: change.amount,
      balanceAfter: creditBalance,
      type: change.type,
      purchaseId: change.purchaseId,
      createdById: change.createdById,
      note: change.note,
    },
  });
}

async function currentActor(tx: Prisma.TransactionClient, actor: SessionIdentity): Promise<Actor> {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { id: true, sessionVersion: true, role: true },
  });
  if (!current || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  return { id: current.id, admin: current.role.name === 'ADMIN' && isRoleValid(current.role) };
}

function requireAdministrator(actor: Actor) {
  if (!actor.admin) throw new AppError(403, 'Administrator access is required');
}

// Admins see every user's records or filter by one user; everyone else sees only their own.
function ownerScope(actor: Actor, userId?: string) {
  if (actor.admin) return userId === undefined ? {} : { userId };
  if (userId !== undefined && userId !== actor.id) throw new AppError(403, 'Administrator access is required');
  return { userId: actor.id };
}

async function findPurchase(tx: Prisma.TransactionClient, actor: Actor, id: string) {
  const purchase = await tx.creditPurchase.findFirst({
    where: { id, ...(actor.admin ? {} : { userId: actor.id }) },
    include: { transaction: true },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');
  return purchase;
}

export function createCreditService(config: CreditConfig) {
  return {
    getBalance(actor: SessionIdentity, userId?: string): Promise<CreditBalance> {
      return serializable(async (tx) => {
        const current = await currentActor(tx, actor);
        const target = ownerScope(current, userId).userId ?? current.id;
        const user = await tx.user.findUnique({ where: { id: target }, select: { creditBalance: true } });
        if (!user) throw new AppError(404, 'User not found');
        return { balance: user.creditBalance, currency: config.currency, unitPriceMinor: config.unitPriceMinor };
      }, conflictMessage);
    },

    listTransactions(actor: SessionIdentity, query: CreditQuery) {
      return serializable(async (tx) => {
        const where = ownerScope(await currentActor(tx, actor), query.userId);
        const transactions = await tx.creditTransaction.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: query.offset,
        });
        const total = await tx.creditTransaction.count({ where });
        return { transactions: transactions.map(publicTransaction), total };
      }, conflictMessage);
    },

    createPurchase(actor: SessionIdentity, data: CreatePurchaseData) {
      return serializable(async (tx) => {
        const current = await currentActor(tx, actor);
        // The price always comes from configuration, never from the client.
        return publicPurchase(await tx.creditPurchase.create({
          data: {
            userId: current.id,
            credits: data.credits,
            unitPriceMinor: config.unitPriceMinor,
            amountMinor: data.credits * config.unitPriceMinor,
            currency: config.currency,
          },
        }));
      }, conflictMessage);
    },

    listPurchases(actor: SessionIdentity, query: CreditQuery) {
      return serializable(async (tx) => {
        const where = {
          ...ownerScope(await currentActor(tx, actor), query.userId),
          ...(query.status === undefined ? {} : { status: query.status }),
        };
        const purchases = await tx.creditPurchase.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: query.offset,
        });
        const total = await tx.creditPurchase.count({ where });
        return { purchases: purchases.map(publicPurchase), total };
      }, conflictMessage);
    },

    cancelPurchase(actor: SessionIdentity, id: string) {
      return serializable(async (tx) => {
        const current = await currentActor(tx, actor);
        const purchase = await findPurchase(tx, current, id);
        if (purchase.status === 'CANCELED') return publicPurchase(purchase);
        if (purchase.status !== 'PENDING') throw new AppError(409, 'Only pending purchases can be canceled');
        return publicPurchase(await tx.creditPurchase.update({
          where: { id },
          data: { status: 'CANCELED', settledById: current.id, settledAt: new Date() },
        }));
      }, conflictMessage);
    },

    // Marks a pending purchase as paid and credits its owner exactly once.
    // Repeating the call returns the original result without crediting again,
    // so a future card-payment webhook can reuse it for retried notifications.
    async confirmPurchase(actor: SessionIdentity, id: string, data: ConfirmPurchaseData) {
      try {
        return await serializable(async (tx) => {
          const current = await currentActor(tx, actor);
          requireAdministrator(current);
          const purchase = await findPurchase(tx, current, id);
          if (purchase.status === 'PAID' && purchase.transaction) {
            return { purchase: publicPurchase(purchase), transaction: publicTransaction(purchase.transaction) };
          }
          if (purchase.status !== 'PENDING') throw new AppError(409, 'Only pending purchases can be confirmed');
          if (purchase.userId === null) throw new AppError(409, 'The purchase owner no longer exists');
          if (data.reference !== undefined && await tx.creditPurchase.count({
            where: { provider: manualProvider, providerPaymentId: data.reference },
          }) > 0) {
            throw new AppError(409, 'This payment reference is already used');
          }
          const paid = await tx.creditPurchase.update({
            where: { id },
            data: {
              status: 'PAID',
              provider: manualProvider,
              providerPaymentId: data.reference ?? null,
              settledById: current.id,
              settledAt: new Date(),
            },
          });
          const transaction = await applyCreditChange(tx, {
            userId: purchase.userId,
            amount: purchase.credits,
            type: 'PURCHASE',
            purchaseId: purchase.id,
            createdById: current.id,
          });
          return { purchase: publicPurchase(paid), transaction: publicTransaction(transaction) };
        }, conflictMessage);
      } catch (error) {
        // Backstop for races the checks above cannot see: a reference or the
        // purchase's single ledger row was written by a concurrent request.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError(409, 'This payment reference is already used, or the purchase was already confirmed');
        }
        throw error;
      }
    },

    failPurchase(actor: SessionIdentity, id: string) {
      return serializable(async (tx) => {
        const current = await currentActor(tx, actor);
        requireAdministrator(current);
        const purchase = await findPurchase(tx, current, id);
        if (purchase.status === 'FAILED') return publicPurchase(purchase);
        if (purchase.status !== 'PENDING') throw new AppError(409, 'Only pending purchases can be marked as failed');
        return publicPurchase(await tx.creditPurchase.update({
          where: { id },
          data: { status: 'FAILED', settledById: current.id, settledAt: new Date() },
        }));
      }, conflictMessage);
    },

    adjust(actor: SessionIdentity, data: AdjustmentData) {
      return serializable(async (tx) => {
        const current = await currentActor(tx, actor);
        requireAdministrator(current);
        return publicTransaction(await applyCreditChange(tx, {
          userId: data.userId,
          amount: data.amount,
          type: 'ADJUSTMENT',
          createdById: current.id,
          note: data.note,
        }));
      }, conflictMessage);
    },
  };
}

export type CreditService = ReturnType<typeof createCreditService>;
