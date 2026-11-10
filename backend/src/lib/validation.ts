import * as z from 'zod';
import { AppError } from './app-error.ts';

// Parse one stage at a time so the first public error follows the API's order,
// rather than Zod's traversal order across unrelated fields.
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, result.error.issues[0].message);
  return result.data;
}

export function objectSchema(message: string) {
  return z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    { error: message },
  );
}

export function allowedKeysSchema(keys: readonly string[], message: string) {
  return objectSchema(message).refine((value) => Object.keys(value).every((key) => keys.includes(key)), { error: message });
}

export function uuidSchema(message: string) {
  return z.string({ error: message })
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { error: message })
    .toLowerCase();
}

export function integerSchema(min: number, max: number, message: string) {
  return z.number({ error: message })
    .refine((value) => Number.isSafeInteger(value) && value >= min && value <= max, { error: message });
}

export function queryIntegerSchema(fallback: number, min: number, max: number, message: string) {
  return z.string({ error: message }).regex(/^\d+$/, { error: message })
    .transform(Number).pipe(integerSchema(min, max, message)).default(fallback);
}
