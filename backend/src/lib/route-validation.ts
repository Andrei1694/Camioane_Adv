import * as z from 'zod';
import { parseBody } from './user-validation.ts';
import { allowedKeysSchema, integerSchema, parse, queryIntegerSchema, uuidSchema } from './validation.ts';
import type { Coordinate, RouteInput, RoutePagination, RouteUpdate } from '../types/route.ts';

const routeIdSchema = uuidSchema('A valid route ID is required');
const querySchema = allowedKeysSchema([], 'Unsupported route fields');
const paginationFields = allowedKeysSchema(['limit', 'offset'], 'Unsupported route fields');
const limitSchema = queryIntegerSchema(50, 1, 100, 'Invalid route pagination');
const offsetSchema = queryIntegerSchema(0, 0, 2147483647, 'Invalid route pagination');
const createFields = allowedKeysSchema(['name', 'waypoints'], 'Unsupported route fields');
const updateFields = allowedKeysSchema(['name', 'waypoints', 'version'], 'Unsupported route fields');
const nameMessage = 'Route names must contain 1–200 characters and no null characters';
const nameSchema = z.string({ error: nameMessage }).trim()
  .refine((name) => name.length > 0 && name.length <= 200 && !name.includes('\0'), { error: nameMessage });
const stopsMessage = 'A route must have 2–100 stops';
const stopsSchema = z.custom<unknown[]>(Array.isArray, { error: stopsMessage })
  .refine((points) => points.length >= 2 && points.length <= 100, { error: stopsMessage });
const coordinateMessage = 'Stops must be [longitude, latitude] pairs within ±180 longitude and ±85.051129 latitude';
const coordinateSchema = z.tuple([
  z.number({ error: coordinateMessage }).min(-180, { error: coordinateMessage }).max(180, { error: coordinateMessage }),
  z.number({ error: coordinateMessage }).min(-85.051129, { error: coordinateMessage }).max(85.051129, { error: coordinateMessage }),
], { error: coordinateMessage });
const versionSchema = integerSchema(1, 2147483646, 'A valid route version is required');

export function parseRouteId(value: unknown) {
  return parse(routeIdSchema, value);
}

export function rejectRouteQuery(query: Record<string, unknown>) {
  parse(querySchema, query);
}

export function parseRoutePagination(query: Record<string, unknown>): RoutePagination {
  parse(paginationFields, query);
  return { limit: parse(limitSchema, query.limit), offset: parse(offsetSchema, query.offset) };
}

export function parseRouteWaypoints(value: unknown): Coordinate[] {
  return parse(stopsSchema, value).map((point) => parse(coordinateSchema, point));
}

function parseInput(data: Record<string, unknown>, updating: boolean): RouteInput {
  parse(updating ? updateFields : createFields, data);
  return { name: parse(nameSchema, data.name), waypoints: parseRouteWaypoints(data.waypoints) };
}

export function parseRouteCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseRouteUpdate(value: unknown): RouteUpdate {
  const data = parseBody(value);
  const input = parseInput(data, true);
  return { ...input, version: parse(versionSchema, data.version) };
}
