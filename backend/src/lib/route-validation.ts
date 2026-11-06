import { AppError } from './app-error.ts';
import { parseBody } from './user-validation.ts';
import type { Coordinate, RouteInput, RoutePagination, RouteUpdate } from '../types/route.ts';

function onlyFields(value: Record<string, unknown>, fields: string[]) {
  if (Object.keys(value).some((key) => !fields.includes(key))) throw new AppError(400, 'Unsupported route fields');
}

export function parseRouteId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, 'A valid route ID is required');
  }
  return value.toLowerCase();
}

export function rejectRouteQuery(query: Record<string, unknown>) {
  onlyFields(query, []);
}

export function parseRoutePagination(query: Record<string, unknown>): RoutePagination {
  onlyFields(query, ['limit', 'offset']);
  function integer(value: unknown, fallback: number, min: number, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'Invalid route pagination');
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max) throw new AppError(400, 'Invalid route pagination');
    return result;
  }
  return { limit: integer(query.limit, 50, 1, 100), offset: integer(query.offset, 0, 0, 2147483647) };
}

export function parseRouteWaypoints(value: unknown): Coordinate[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 100) {
    throw new AppError(400, 'A route must have 2–100 stops');
  }
  return value.map((point: unknown): Coordinate => {
    if (!Array.isArray(point) || point.length !== 2
      || typeof point[0] !== 'number' || !Number.isFinite(point[0]) || Math.abs(point[0]) > 180
      || typeof point[1] !== 'number' || !Number.isFinite(point[1]) || Math.abs(point[1]) > 85.051129) {
      throw new AppError(400, 'Stops must be [longitude, latitude] pairs within ±180 longitude and ±85.051129 latitude');
    }
    return [point[0], point[1]];
  });
}

function parseInput(data: Record<string, unknown>, updating: boolean): RouteInput {
  onlyFields(data, updating ? ['name', 'waypoints', 'version'] : ['name', 'waypoints']);
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 200 || data.name.includes('\0')) {
    throw new AppError(400, 'Route names must contain 1–200 characters and no null characters');
  }
  return { name: data.name.trim(), waypoints: parseRouteWaypoints(data.waypoints) };
}

export function parseRouteCreate(value: unknown) {
  return parseInput(parseBody(value), false);
}

export function parseRouteUpdate(value: unknown): RouteUpdate {
  const data = parseBody(value);
  const input = parseInput(data, true);
  if (typeof data.version !== 'number' || !Number.isSafeInteger(data.version) || data.version < 1 || data.version >= 2147483647) {
    throw new AppError(400, 'A valid route version is required');
  }
  return { ...input, version: data.version };
}
