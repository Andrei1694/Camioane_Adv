import * as z from 'zod';
import { CarRoute, CarStatus } from '../generated/prisma/client.ts';
import { parseBody } from './user-validation.ts';
import { allowedKeysSchema, integerSchema, parse, uuidSchema } from './validation.ts';
import type { CarInput, CarUpdate } from '../types/car.ts';

export function plateKey(plate: string) {
  return plate.toUpperCase().replace(/[\s-]/g, '');
}

function textSchema(label: string, maxLength: number, required: boolean, uppercase = false) {
  return z.string({ error: `${label} must be a string` }).trim()
    .transform((text) => uppercase ? text.toUpperCase() : text)
    .refine((text) => !required || text.length > 0, { error: `${label} is required`, abort: true })
    .refine((text) => !text.includes('\0') && text.length <= maxLength, {
      error: `${label} must contain at most ${maxLength} characters and no null characters`,
    });
}

const carIdSchema = uuidSchema('A valid car ID is required');
const querySchema = allowedKeysSchema([], 'Car endpoints do not accept query parameters');
const fields = ['plate', 'makeModel', 'driverName', 'routeId', 'status'];
const createFields = allowedKeysSchema(fields, 'Unsupported car fields');
const updateFields = allowedKeysSchema([...fields, 'version'], 'Unsupported car fields');
const plateSchema = textSchema('License plate', 32, true, true)
  .refine((plate) => Boolean(plateKey(plate)), { error: 'Enter a license plate' });
const modelSchema = textSchema('Make/model', 200, true);
const driverSchema = textSchema('Driver name', 200, false);
const routeSchema = z.enum(CarRoute, { error: 'Route must be centru, nord, vest, est, sud, or null' }).nullable();
const statusSchema = z.enum(CarStatus, { error: 'Status must be active, maintenance, or inactive' });
const versionSchema = integerSchema(1, 2147483646, 'A valid car version is required');

export function parseCarId(value: unknown) {
  return parse(carIdSchema, value);
}

export function rejectCarQuery(query: Record<string, unknown>) {
  parse(querySchema, query);
}

function parseInput(data: Record<string, unknown>, updating: boolean): CarInput {
  parse(updating ? updateFields : createFields, data);
  const plate = parse(plateSchema, data.plate);
  const makeModel = parse(modelSchema, data.makeModel);
  const driverName = parse(driverSchema, data.driverName);
  const routeId = parse(routeSchema, data.routeId);
  const status = parse(statusSchema, data.status);
  return { plate, makeModel, driverName, routeId, status };
}

export function parseCarCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseCarUpdate(value: unknown): CarUpdate {
  const data = parseBody(value);
  const input = parseInput(data, true);
  return { ...input, version: parse(versionSchema, data.version) };
}
