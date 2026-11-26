import * as z from 'zod';
import { parseBody } from './user-validation.ts';
import { allowedKeysSchema, integerSchema, parse, uuidSchema } from './validation.ts';
import type { ConfigVariableInput, ConfigVariableUpdate } from '../types/config-variable.ts';

const idSchema = uuidSchema('A valid configuration variable ID is required');
const querySchema = allowedKeysSchema([], 'Configuration variable endpoints do not accept query parameters');
const fields = ['name', 'value', 'description'];
const createFields = allowedKeysSchema(fields, 'Unsupported configuration variable fields');
const updateFields = allowedKeysSchema([...fields, 'version'], 'Unsupported configuration variable fields');
const nameMessage = 'Configuration variable names must contain 1–200 characters and no null characters';
const nameSchema = z.string({ error: nameMessage }).trim()
  .refine((name) => name.length > 0 && name.length <= 200 && !name.includes('\0'), { error: nameMessage });
const valueSchema = z.string({ error: 'Value must be a string' })
  .refine((value) => !value.includes('\0'), { error: 'Value must not contain null characters' });
const descriptionSchema = z.string({ error: 'Description must be a string' }).trim()
  .refine((description) => !description.includes('\0'), { error: 'Description must not contain null characters' });
const versionSchema = integerSchema(1, 2147483646, 'A valid configuration variable version is required');

export function parseConfigVariableId(value: unknown) {
  return parse(idSchema, value);
}

export function rejectConfigVariableQuery(query: Record<string, unknown>) {
  parse(querySchema, query);
}

function parseInput(data: Record<string, unknown>, updating: boolean): ConfigVariableInput {
  parse(updating ? updateFields : createFields, data);
  const name = parse(nameSchema, data.name);
  const value = parse(valueSchema, data.value);
  const description = parse(descriptionSchema, data.description);
  return { name, value, description };
}

export function parseConfigVariableCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseConfigVariableUpdate(value: unknown): ConfigVariableUpdate {
  const data = parseBody(value);
  return { ...parseInput(data, true), version: parse(versionSchema, data.version) };
}
