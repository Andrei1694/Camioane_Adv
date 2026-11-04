import type { CreditPurchase, CreditTransaction } from '../generated/prisma/client.ts';
import type { CreditPurchaseStatus, CreditTransactionType } from '../generated/prisma/enums.ts';

export type PublicCreditPurchase = Pick<CreditPurchase,
  'id' | 'userId' | 'credits' | 'unitPriceMinor' | 'amountMinor' | 'currency' | 'status' | 'createdAt' | 'settledAt'
> & { reference: string | null };

export type PublicCreditTransaction = Pick<CreditTransaction,
  'id' | 'userId' | 'amount' | 'balanceAfter' | 'type' | 'purchaseId' | 'note' | 'createdAt'
>;

export interface CreditBalance {
  balance: number;
  currency: string;
  unitPriceMinor: number;
}

export interface CreditQuery {
  limit: number;
  offset: number;
  userId?: string;
  status?: CreditPurchaseStatus;
}

export interface CreatePurchaseData {
  credits: number;
}

export interface ConfirmPurchaseData {
  reference?: string;
}

export interface AdjustmentData {
  userId: string;
  amount: number;
  note: string;
}

export interface CreditChange {
  userId: string;
  /** Positive adds credits, negative removes them. */
  amount: number;
  type: CreditTransactionType;
  purchaseId?: string;
  createdById?: string;
  note?: string;
}
