import { AppError } from './app-error.ts';

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function onlyKeys(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new AppError(400, `Only ${allowed.join(', ')} can be provided`);
  }
}

export function parseInteger(value: unknown, min: number, max: number, message: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError(400, message);
  }
  return value;
}

export function parseText(value: unknown, maxLength: number, label: string) {
  if (typeof value !== 'string') throw new AppError(400, `${label} must be a string`);
  const text = value.trim();
  const length = Array.from(text).length;
  if (length < 1 || length > maxLength) throw new AppError(400, `${label} must contain between 1 and ${maxLength} characters`);
  return text;
}

export function parseQueryInteger(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'Invalid pagination');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new AppError(400, 'Invalid pagination');
  return parsed;
}
