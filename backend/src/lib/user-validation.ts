import * as z from 'zod';
import { RoleName, UserStatus } from '../generated/prisma/enums.ts';
import { allowedKeysSchema, objectSchema, parse, uuidSchema } from './validation.ts';
import type { CreateUserData, UpdateUserData, UserCredentials } from '../types/user.ts';

export const emailSchema = z.string({ error: 'Email must be a string' }).trim().toLowerCase()
  .refine((email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), { error: 'A valid email address is required' });
const passwordSchema = z.string({ error: 'Password must be a string' }).refine((password) => {
  const length = Array.from(password).length;
  return length >= 12 && length <= 128;
}, { error: 'Password must contain between 12 and 128 characters' });
const roleSchema = z.enum(RoleName, { error: 'Role must be ADMIN, OPERATOR, DRIVER, or USER' });
const statusSchema = z.enum(UserStatus, { error: 'Status must be ACTIVE or DISABLED' });
const displayNameSchema = z.string({ error: 'Display name must be a string' }).trim()
  .refine((name) => name.length <= 200 && !name.includes('\0'), { error: 'Display name must contain at most 200 characters and no null characters' });
const phoneSchema = z.string({ error: 'Phone must be a string or null' }).trim()
  .regex(/^\+[1-9]\d{1,14}$/, { error: 'Phone must use international format, for example +40712345678' }).nullable();
const bodySchema = objectSchema('A JSON object is required').transform((body) => Object.fromEntries(Object.entries(body)));
const fieldsSchema = allowedKeysSchema(['email', 'password', 'role', 'displayName', 'phone', 'status'], 'Only email, password, role, displayName, phone, and status can be changed');
const updateSchema = fieldsSchema.refine((data) => Object.keys(data).length > 0, { error: 'Provide at least one field to update' });
const userIdSchema = uuidSchema('A valid user ID is required');

export function parseEmail(value: unknown): string {
  return parse(emailSchema, value);
}

export function parsePassword(value: unknown): string {
  return parse(passwordSchema, value);
}

export function parseDisplayName(value: unknown): string {
  return parse(displayNameSchema, value);
}

function parseAccountFields(data: Record<string, unknown>): Partial<CreateUserData> {
  return {
    ...('displayName' in data ? { displayName: parseDisplayName(data.displayName) } : {}),
    ...('phone' in data ? { phone: parse(phoneSchema, data.phone) } : {}),
    ...('status' in data ? { status: parse(statusSchema, data.status) } : {}),
  };
}

function parseRole(value: unknown): CreateUserData['role'] {
  return parse(roleSchema, value);
}

export function parseBody(body: unknown): Record<string, unknown> {
  return parse(bodySchema, body);
}

export function parseCredentials(body: unknown): UserCredentials {
  const data = parseBody(body);
  return { email: parseEmail(data.email), password: parsePassword(data.password) };
}

export function parseCreateUser(body: unknown): CreateUserData {
  const data = parseBody(body);
  parse(fieldsSchema, data);
  return { ...parseCredentials(data), role: data.role === undefined ? 'USER' : parseRole(data.role), ...parseAccountFields(data) };
}

export function parseUpdateUser(body: unknown): UpdateUserData {
  const data = parseBody(body);
  parse(updateSchema, data);
  const update: UpdateUserData = {};
  if ('email' in data) update.email = parseEmail(data.email);
  if ('password' in data) update.password = parsePassword(data.password);
  if ('role' in data) update.role = parseRole(data.role);
  return { ...update, ...parseAccountFields(data) };
}

export function isUserId(value: unknown): value is string {
  return userIdSchema.safeParse(value).success;
}

export function parseUserId(value: unknown): string {
  return parse(userIdSchema, value);
}
