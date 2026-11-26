import * as z from 'zod';
import type { BillingData } from '../types/billing.ts';
import { emailSchema } from './user-validation.ts';
import { allowedKeysSchema, objectSchema, parse } from './validation.ts';

const bodySchema = objectSchema('A JSON object is required');
const fieldsSchema = allowedKeysSchema(['companyName', 'cui', 'address', 'email'], 'Only companyName, cui, address, and email can be changed');
const companyNameSchema = z.string({ error: 'Company name must be a string' }).trim()
  .refine((name) => name.length > 0 && name.length <= 200 && !name.includes('\0'), { error: 'Company name must contain 1–200 characters and no null characters' });
const cuiSchema = z.string({ error: 'CUI must be a string' }).trim().toUpperCase()
  .transform((cui) => cui.replace(/\s/g, ''))
  .pipe(z.string().regex(/^(RO)?[1-9]\d{1,9}$/, { error: 'CUI must contain 2–10 digits, starting with a nonzero digit, optionally prefixed with RO' }));
const addressSchema = z.string({ error: 'Address must be a string' }).trim()
  .refine((address) => address.length > 0 && address.length <= 500 && !address.includes('\0'), { error: 'Address must contain 1–500 characters and no null characters' });

export function parseBilling(body: unknown): BillingData {
  const data = parse(bodySchema, body);
  parse(fieldsSchema, data);
  return {
    companyName: parse(companyNameSchema, data.companyName),
    cui: parse(cuiSchema, data.cui),
    address: parse(addressSchema, data.address),
    email: parse(emailSchema, data.email),
  };
}
