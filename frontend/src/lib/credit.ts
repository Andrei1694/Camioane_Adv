// Credit purchases and ledger rows as the /credits API returns them (backend/src/types/credit.ts).

export const purchaseStatuses = ['PENDING', 'PAID', 'FAILED', 'CANCELED'] as const
export type PurchaseStatus = typeof purchaseStatuses[number]

export const transactionTypes = ['PURCHASE', 'ADJUSTMENT', 'CAMPAIGN_DEBIT', 'REFUND'] as const
export type TransactionType = typeof transactionTypes[number]

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return purchaseStatuses.some((status) => status === value)
}

export function isTransactionType(value: unknown): value is TransactionType {
  return transactionTypes.some((type) => type === value)
}

export interface CreditPurchase {
  id: string
  /** Null once the owner's account has been deleted; the record is kept. */
  userId: string | null
  credits: number
  /** Price of one credit in the currency's minor unit, fixed when the purchase was made. */
  unitPriceMinor: number
  amountMinor: number
  currency: string
  status: PurchaseStatus
  /** The payment reference an admin entered when confirming, if any. */
  reference: string | null
  createdAt: string
  settledAt: string | null
}

export interface CreditTransaction {
  id: string
  userId: string | null
  /** Positive adds credits, negative removes them; never zero. */
  amount: number
  balanceAfter: number
  type: TransactionType
  purchaseId: string | null
  note: string | null
  createdAt: string
}

export interface CreditBalance {
  balance: number
  currency: string
  unitPriceMinor: number
}

export interface PurchasePage {
  purchases: CreditPurchase[]
  total: number
}

export interface TransactionPage {
  transactions: CreditTransaction[]
  total: number
}

export interface Adjustment {
  userId: string
  amount: number
  note: string
}

// Mirror the limits in backend/src/lib/credit-validation.ts. The API stays the authority.
export const maxAdjustment = 1_000_000
export const maxReferenceLength = 128
export const maxNoteLength = 500

export const purchaseStatusPills: Record<PurchaseStatus, { label: string, tone: 'positive' | 'negative' | 'warning' | 'neutral' }> = {
  PENDING: { label: 'În așteptarea plății', tone: 'warning' },
  PAID: { label: 'Plătită', tone: 'positive' },
  FAILED: { label: 'Plată eșuată', tone: 'negative' },
  CANCELED: { label: 'Anulată', tone: 'neutral' },
}

export const transactionTypeLabels: Record<TransactionType, string> = {
  PURCHASE: 'Achiziție',
  ADJUSTMENT: 'Ajustare',
  CAMPAIGN_DEBIT: 'Debit pentru campanie',
  REFUND: 'Rambursare',
}
