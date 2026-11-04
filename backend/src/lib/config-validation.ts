import type { Prisma } from '../generated/prisma/client.ts';
import { AppError } from './app-error.ts';
import { parseBody } from './user-validation.ts';

// Keep in sync with the AppConfig_key_check constraint in the add_app_config migration.
const keyPattern = /^[a-z][a-z0-9_.-]{0,99}$/;
const maxValueDepth = 32;

export function parseConfigKey(value: unknown) {
  if (typeof value !== 'string' || !keyPattern.test(value)) {
    throw new AppError(400,
      'Config keys use 1–100 lowercase letters, digits, dots, underscores or hyphens, starting with a letter');
  }
  return value;
}

// Bodies come from JSON.parse, so this only fails on depth; it also gives
// Prisma a JSON input type without an assertion.
function isJsonValue(value: unknown, depth: number): value is Prisma.InputJsonValue | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth >= maxValueDepth) return false;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.every((child) => isJsonValue(child, depth + 1));
}

export function parseConfigValue(body: unknown): Prisma.InputJsonValue {
  const data = parseBody(body);
  if (Object.keys(data).some((key) => key !== 'value')) throw new AppError(400, 'Only value can be provided');
  const { value } = data;
  if (value === undefined || value === null) throw new AppError(400, 'A value is required; delete the key to clear it');
  if (!isJsonValue(value, 0)) throw new AppError(400, `Values can nest at most ${maxValueDepth} levels deep`);
  return value;
}
