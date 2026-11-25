import * as z from 'zod';
import { AppError } from './app-error.ts';
import { parseBody } from './user-validation.ts';
import { allowedKeysSchema, integerSchema, parse, uuidSchema } from './validation.ts';
import type { ScreenCanvas, ScreenPresetInput, ScreenPresetUpdate, ScreenRegion, ScreenRegions } from '../types/screen-preset.ts';

const idSchema = uuidSchema('A valid screen preset ID is required');
const querySchema = allowedKeysSchema([], 'Screen preset endpoints do not accept query parameters');
const fields = ['name', 'canvas', 'regions'];
const createFields = allowedKeysSchema(fields, 'Unsupported screen preset fields');
const updateFields = allowedKeysSchema([...fields, 'version'], 'Unsupported screen preset fields');
const nameMessage = 'Screen preset names must contain 1–200 characters and no null characters';
const nameSchema = z.string({ error: nameMessage }).trim()
  .refine((name) => name.length > 0 && name.length <= 200 && !name.includes('\0'), { error: nameMessage });
const canvasFields = allowedKeysSchema(['width', 'height'], 'Canvas must contain width and height only');
const dimensionMessage = 'Canvas dimensions must be even integers between 16 and 4096';
const dimensionSchema = integerSchema(16, 4096, dimensionMessage)
  .refine((value) => value % 2 === 0, { error: dimensionMessage });
const regionsFields = allowedKeysSchema(['left', 'middle', 'right'], 'Regions must contain left, middle and right only');
const regionFields = allowedKeysSchema(['x', 'y', 'width', 'height', 'fit'], 'Each region must contain x, y, width, height and fit only');
const positionSchema = integerSchema(0, 4095, 'Region positions must be non-negative integers within the canvas');
const sizeSchema = integerSchema(1, 4096, 'Region dimensions must be positive integers within the canvas');
const fitSchema = z.enum(['cover', 'contain'], { error: 'Region fit must be cover or contain' });
const versionSchema = integerSchema(1, 2147483646, 'A valid screen preset version is required');

export function parseScreenPresetId(value: unknown) {
  return parse(idSchema, value);
}

export function rejectScreenPresetQuery(query: Record<string, unknown>) {
  parse(querySchema, query);
}

function parseCanvas(value: unknown): ScreenCanvas {
  const data = parse(canvasFields, value);
  return { width: parse(dimensionSchema, data.width), height: parse(dimensionSchema, data.height) };
}

export function parseScreenPresetRegions(value: unknown, canvas: ScreenCanvas): ScreenRegions {
  const bounds = parseCanvas(canvas);
  const data = parse(regionsFields, value);
  function region(value: unknown): ScreenRegion {
    const fields = parse(regionFields, value);
    const result = {
      x: parse(positionSchema, fields.x), y: parse(positionSchema, fields.y),
      width: parse(sizeSchema, fields.width), height: parse(sizeSchema, fields.height),
      fit: parse(fitSchema, fields.fit),
    };
    if (result.x + result.width > bounds.width || result.y + result.height > bounds.height) {
      throw new AppError(400, 'Each region must fit entirely within the canvas');
    }
    return result;
  }
  return { left: region(data.left), middle: region(data.middle), right: region(data.right) };
}

function parseInput(data: Record<string, unknown>, updating: boolean): ScreenPresetInput {
  parse(updating ? updateFields : createFields, data);
  const name = parse(nameSchema, data.name);
  const canvas = parseCanvas(data.canvas);
  return { name, canvas, regions: parseScreenPresetRegions(data.regions, canvas) };
}

export function parseScreenPresetCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseScreenPresetUpdate(value: unknown): ScreenPresetUpdate {
  const data = parseBody(value);
  return { ...parseInput(data, true), version: parse(versionSchema, data.version) };
}
