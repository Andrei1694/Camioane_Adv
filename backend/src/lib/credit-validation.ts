import * as z from 'zod';
import { MAX_CREDITS_PER_PURCHASE } from '../config/credits.ts';
import { CreditPurchaseStatus } from '../generated/prisma/enums.ts';
import { parseBody, parseUserId } from './user-validation.ts';
import { allowedKeysSchema, integerSchema, parse, queryIntegerSchema, uuidSchema } from './validation.ts';
import type { AdjustmentData, ConfirmPurchaseData, CreatePurchaseData, CreditQuery } from '../types/credit.ts';

const maxAdjustment = 1000000;
const purchaseIdSchema = uuidSchema('A valid purchase ID is required');
const creditsSchema = integerSchema(1, MAX_CREDITS_PER_PURCHASE,
  `Credits must be a whole number between 1 and ${MAX_CREDITS_PER_PURCHASE}`);
const amountSchema = integerSchema(-maxAdjustment, maxAdjustment,
  `Amount must be a whole number between -${maxAdjustment} and ${maxAdjustment}`)
  .refine((amount) => amount !== 0, { error: 'Amount must not be zero' });
const limitSchema = queryIntegerSchema(50, 1, 100, 'Invalid pagination');
const offsetSchema = queryIntegerSchema(0, 0, 2147483647, 'Invalid pagination');
const statusSchema = z.enum(CreditPurchaseStatus, { error: `Status must be ${Object.values(CreditPurchaseStatus).join(', ')}` });

function fieldsSchema(fields: string[]) {
  return allowedKeysSchema(fields, `Only ${fields.join(', ')} can be provided`);
}

function textSchema(maxLength: number, label: string) {
  return z.string({ error: `${label} must be a string` }).trim().refine((text) => {
    const length = Array.from(text).length;
    return length >= 1 && length <= maxLength;
  }, { error: `${label} must contain between 1 and ${maxLength} characters` });
}

const purchaseFields = fieldsSchema(['credits']);
const confirmationFields = fieldsSchema(['reference']);
const adjustmentFields = fieldsSchema(['userId', 'amount', 'note']);
const userFields = fieldsSchema(['userId']);
const transactionFields = fieldsSchema(['limit', 'offset', 'userId']);
const queryPurchaseFields = fieldsSchema(['limit', 'offset', 'userId', 'status']);
const referenceSchema = textSchema(128, 'Reference');
const noteSchema = textSchema(500, 'Note');

export function parsePurchaseId(value: unknown) {
  return parse(purchaseIdSchema, value);
}

export function parseCreatePurchase(body: unknown): CreatePurchaseData {
  const data = parse(purchaseFields, parseBody(body));
  return { credits: parse(creditsSchema, data.credits) };
}

export function parseConfirmPurchase(body: unknown): ConfirmPurchaseData {
  // The body is optional: without a Content-Type, Express leaves it undefined.
  if (body === undefined) return {};
  const data = parse(confirmationFields, parseBody(body));
  return data.reference === undefined ? {} : { reference: parse(referenceSchema, data.reference) };
}

export function parseAdjustment(body: unknown): AdjustmentData {
  const data = parse(adjustmentFields, parseBody(body));
  const amount = parse(amountSchema, data.amount);
  return { userId: parseUserId(data.userId), amount, note: parse(noteSchema, data.note) };
}

export function parseUserFilter(query: Record<string, unknown>) {
  parse(userFields, query);
  return query.userId === undefined ? undefined : parseUserId(query.userId);
}

export function parseCreditQuery(query: Record<string, unknown>, options: { status: boolean }): CreditQuery {
  parse(options.status ? queryPurchaseFields : transactionFields, query);
  return {
    limit: parse(limitSchema, query.limit),
    offset: parse(offsetSchema, query.offset),
    ...(query.userId === undefined ? {} : { userId: parseUserId(query.userId) }),
    ...(query.status === undefined ? {} : { status: parse(statusSchema, query.status) }),
  };
}
