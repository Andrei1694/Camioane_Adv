import { CarRoute, CarStatus } from '../generated/prisma/client.ts';
import { AppError } from './app-error.ts';
import { parseBody } from './user-validation.ts';
import type { CarInput, CarUpdate } from '../types/car.ts';

export function plateKey(plate: string) {
  return plate.toUpperCase().replace(/[\s-]/g, '');
}

export function parseCarId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, 'A valid car ID is required');
  }
  return value.toLowerCase();
}

export function rejectCarQuery(query: Record<string, unknown>) {
  if (Object.keys(query).length) throw new AppError(400, 'Car endpoints do not accept query parameters');
}

function isCarRoute(value: unknown): value is CarRoute {
  return Object.values(CarRoute).some((route) => route === value);
}

function isCarStatus(value: unknown): value is CarStatus {
  return Object.values(CarStatus).some((status) => status === value);
}

function text(value: unknown, label: string, maxLength: number, required: boolean, uppercase = false) {
  if (typeof value !== 'string') throw new AppError(400, `${label} must be a string`);
  const trimmed = value.trim();
  const result = uppercase ? trimmed.toUpperCase() : trimmed;
  if (required && !result) throw new AppError(400, `${label} is required`);
  if (result.includes('\0') || result.length > maxLength) {
    throw new AppError(400, `${label} must contain at most ${maxLength} characters and no null characters`);
  }
  return result;
}

function parseInput(data: Record<string, unknown>, updating: boolean): CarInput {
  const fields = ['plate', 'makeModel', 'driverName', 'routeId', 'status', ...(updating ? ['version'] : [])];
  if (Object.keys(data).some((key) => !fields.includes(key))) throw new AppError(400, 'Unsupported car fields');
  const plate = text(data.plate, 'License plate', 32, true, true);
  if (!plateKey(plate)) throw new AppError(400, 'Enter a license plate');
  const makeModel = text(data.makeModel, 'Make/model', 200, true);
  const driverName = text(data.driverName, 'Driver name', 200, false);
  const routeId = data.routeId;
  const status = data.status;
  if (routeId !== null && !isCarRoute(routeId)) {
    throw new AppError(400, 'Route must be centru, nord, vest, est, sud, or null');
  }
  if (!isCarStatus(status)) {
    throw new AppError(400, 'Status must be active, maintenance, or inactive');
  }
  return { plate, makeModel, driverName, routeId, status };
}

export function parseCarCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseCarUpdate(value: unknown): CarUpdate {
  const data = parseBody(value);
  const input = parseInput(data, true);
  if (typeof data.version !== 'number' || !Number.isSafeInteger(data.version) || data.version < 1 || data.version >= 2147483647) {
    throw new AppError(400, 'A valid car version is required');
  }
  return { ...input, version: data.version };
}
