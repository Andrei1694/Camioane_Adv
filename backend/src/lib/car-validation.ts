import { AppError } from './app-error.ts';
import { parseBody } from './user-validation.ts';
import { onlyKeys, parseInteger, parseQueryInteger, parseText, uuidPattern } from './validation.ts';
import type { CarDetails, CarQuery, CreateCarData, UpdateCarData } from '../types/car.ts';

const carKeys = ['plate', 'active', 'info'];
const minYear = 1900;

export function parseCarId(value: unknown) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(400, 'A valid car ID is required');
  return value.toLowerCase();
}

// Stores one spelling per plate: "b-101 cmn" and "B 101 CMN" both become "B101CMN".
function parsePlate(value: unknown) {
  if (typeof value !== 'string') throw new AppError(400, 'Plate must be a string');
  const plate = value.replace(/[\s-]+/g, '');
  // Checked before uppercasing so letters like "ß" are rejected rather than mapped to ASCII.
  if (!/^[A-Za-z0-9]{2,12}$/.test(plate)) {
    throw new AppError(400, 'Plate must contain 2 to 12 letters (A-Z) and digits; spaces and hyphens are ignored');
  }
  return plate.toUpperCase();
}

function parseActive(value: unknown) {
  if (typeof value !== 'boolean') throw new AppError(400, 'Active must be true or false');
  return value;
}

function parseInfo(value: unknown): CarDetails | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Info must be an object or null');
  const data = parseBody(value);
  onlyKeys(data, ['make', 'model', 'year']);
  const maxYear = new Date().getUTCFullYear() + 1;
  return {
    make: parseText(data.make, 64, 'Make'),
    model: parseText(data.model, 64, 'Model'),
    year: parseInteger(data.year, minYear, maxYear, `Year must be a whole number between ${minYear} and ${maxYear}`),
  };
}

export function parseCreateCar(body: unknown): CreateCarData {
  const data = parseBody(body);
  onlyKeys(data, carKeys);
  return {
    plate: parsePlate(data.plate),
    active: data.active === undefined ? true : parseActive(data.active),
    info: data.info === undefined ? null : parseInfo(data.info),
  };
}

export function parseUpdateCar(body: unknown): UpdateCarData {
  const data = parseBody(body);
  onlyKeys(data, carKeys);
  if (Object.keys(data).length === 0) throw new AppError(400, 'Provide at least one field to update');
  const update: UpdateCarData = {};
  if ('plate' in data) update.plate = parsePlate(data.plate);
  if ('active' in data) update.active = parseActive(data.active);
  if ('info' in data) update.info = parseInfo(data.info);
  return update;
}

export function parseCarQuery(query: Record<string, unknown>): CarQuery {
  onlyKeys(query, ['limit', 'offset']);
  return {
    limit: parseQueryInteger(query.limit, 50, 1, 100),
    offset: parseQueryInteger(query.offset, 0, 0, 2147483647),
  };
}
