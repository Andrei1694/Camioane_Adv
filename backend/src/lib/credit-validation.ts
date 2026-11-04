import { MAX_CREDITS_PER_PURCHASE } from '../config/credits.ts';
import { CreditPurchaseStatus } from '../generated/prisma/enums.ts';
import { AppError } from './app-error.ts';
import { parseBody, parseUserId } from './user-validation.ts';
import { onlyKeys, parseInteger, parseQueryInteger, parseText, uuidPattern } from './validation.ts';
import type { AdjustmentData, ConfirmPurchaseData, CreatePurchaseData, CreditQuery } from '../types/credit.ts';

const maxAdjustment = 1000000;

export function parsePurchaseId(value: unknown) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(400, 'A valid purchase ID is required');
  return value.toLowerCase();
}

export function parseCreatePurchase(body: unknown): CreatePurchaseData {
  const data = parseBody(body);
  onlyKeys(data, ['credits']);
  return {
    credits: parseInteger(data.credits, 1, MAX_CREDITS_PER_PURCHASE,
      `Credits must be a whole number between 1 and ${MAX_CREDITS_PER_PURCHASE}`),
  };
}

export function parseConfirmPurchase(body: unknown): ConfirmPurchaseData {
  // The body is optional: without a Content-Type, Express leaves it undefined.
  if (body === undefined) return {};
  const data = parseBody(body);
  onlyKeys(data, ['reference']);
  return data.reference === undefined ? {} : { reference: parseText(data.reference, 128, 'Reference') };
}

export function parseAdjustment(body: unknown): AdjustmentData {
  const data = parseBody(body);
  onlyKeys(data, ['userId', 'amount', 'note']);
  const amount = parseInteger(data.amount, -maxAdjustment, maxAdjustment,
    `Amount must be a whole number between -${maxAdjustment} and ${maxAdjustment}`);
  if (amount === 0) throw new AppError(400, 'Amount must not be zero');
  return { userId: parseUserId(data.userId), amount, note: parseText(data.note, 500, 'Note') };
}

function parseStatus(value: unknown) {
  const status = Object.values(CreditPurchaseStatus).find((name) => name === value);
  if (!status) throw new AppError(400, `Status must be ${Object.values(CreditPurchaseStatus).join(', ')}`);
  return status;
}

export function parseUserFilter(query: Record<string, unknown>) {
  onlyKeys(query, ['userId']);
  return query.userId === undefined ? undefined : parseUserId(query.userId);
}

export function parseCreditQuery(query: Record<string, unknown>, options: { status: boolean }): CreditQuery {
  onlyKeys(query, options.status ? ['limit', 'offset', 'userId', 'status'] : ['limit', 'offset', 'userId']);
  return {
    limit: parseQueryInteger(query.limit, 50, 1, 100),
    offset: parseQueryInteger(query.offset, 0, 0, 2147483647),
    ...(query.userId === undefined ? {} : { userId: parseUserId(query.userId) }),
    ...(query.status === undefined ? {} : { status: parseStatus(query.status) }),
  };
}
