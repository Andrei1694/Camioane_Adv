import * as z from 'zod';
import { RoleName } from '../generated/prisma/enums.ts';
import { allowedKeysSchema, objectSchema, parse, uuidSchema } from './validation.ts';
import type { CreateUserData, UpdateUserData, UserCredentials } from '../types/user.ts';

const emailSchema = z.string({ error: 'Email must be a string' }).trim().toLowerCase()
  .refine((email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), { error: 'A valid email address is required' });
const passwordSchema = z.string({ error: 'Password must be a string' }).refine((password) => {
  const length = Array.from(password).length;
  return length >= 12 && length <= 128;
}, { error: 'Password must contain between 12 and 128 characters' });
const roleSchema = z.enum(RoleName, { error: 'Role must be ADMIN, OPERATOR, DRIVER, or USER' });
const bodySchema = objectSchema('A JSON object is required').transform((body) => Object.fromEntries(Object.entries(body)));
const fieldsSchema = allowedKeysSchema(['email', 'password', 'role'], 'Only email, password, and role can be changed');
const updateSchema = fieldsSchema.refine((data) => Object.keys(data).length > 0, { error: 'Provide at least one field to update' });
const userIdSchema = uuidSchema('A valid user ID is required');

export function parseEmail(value: unknown): string {
  return parse(emailSchema, value);
}

export function parsePassword(value: unknown): string {
  return parse(passwordSchema, value);
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
  return { ...parseCredentials(data), role: data.role === undefined ? 'USER' : parseRole(data.role) };
}

export function parseUpdateUser(body: unknown): UpdateUserData {
  const data = parseBody(body);
  parse(updateSchema, data);
  const update: UpdateUserData = {};
  if ('email' in data) update.email = parseEmail(data.email);
  if ('password' in data) update.password = parsePassword(data.password);
  if ('role' in data) update.role = parseRole(data.role);
  return update;
}

export function isUserId(value: unknown): value is string {
  return userIdSchema.safeParse(value).success;
}

export function parseUserId(value: unknown): string {
  return parse(userIdSchema, value);
}
