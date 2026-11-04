import { AppError } from './app-error.ts';
import { isRoleName } from './role.ts';
import type { CreateUserData, UpdateUserData, UserCredentials } from '../types/user.ts';

export function parseEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AppError(400, 'Email must be a string');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'A valid email address is required');
  }
  return email;
}

export function parsePassword(value: unknown): string {
  if (typeof value !== 'string') throw new AppError(400, 'Password must be a string');
  const length = Array.from(value).length;
  if (length < 12 || length > 128) throw new AppError(400, 'Password must contain between 12 and 128 characters');
  return value;
}

function parseRole(value: unknown): CreateUserData['role'] {
  if (!isRoleName(value)) throw new AppError(400, 'Role must be ADMIN, OPERATOR, DRIVER, or USER');
  return value;
}

export function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'A JSON object is required');
  }
  return Object.fromEntries(Object.entries(body));
}

export function parseCredentials(body: unknown): UserCredentials {
  const data = parseBody(body);
  return { email: parseEmail(data.email), password: parsePassword(data.password) };
}

export function parseCreateUser(body: unknown): CreateUserData {
  const data = parseBody(body);
  checkKeys(data);
  return { ...parseCredentials(data), role: data.role === undefined ? 'USER' : parseRole(data.role) };
}

function checkKeys(data: Record<string, unknown>) {
  if (Object.keys(data).some((key) => !['email', 'password', 'role'].includes(key))) {
    throw new AppError(400, 'Only email, password, and role can be changed');
  }
}

export function parseUpdateUser(body: unknown): UpdateUserData {
  const data = parseBody(body);
  checkKeys(data);
  if (Object.keys(data).length === 0) throw new AppError(400, 'Provide at least one field to update');
  const update: UpdateUserData = {};
  if ('email' in data) update.email = parseEmail(data.email);
  if ('password' in data) update.password = parsePassword(data.password);
  if ('role' in data) update.role = parseRole(data.role);
  return update;
}

export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseUserId(value: unknown): string {
  if (!isUserId(value)) throw new AppError(400, 'A valid user ID is required');
  return value.toLowerCase();
}
