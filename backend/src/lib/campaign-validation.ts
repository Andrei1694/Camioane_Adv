import { AppError } from './app-error.ts';
import type { CampaignDay, CampaignInput, CampaignPagination, CampaignUpdate } from '../types/campaign.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function campaignToday(now = new Date()) {
  const parts = dateFormat.formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyFields(value: Record<string, unknown>, fields: string[]) {
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new AppError(400, 'Unsupported campaign fields');
  }
}

export function parseCampaignId(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new AppError(400, 'A valid campaign ID is required');
  return value.toLowerCase();
}

export function parseCampaignPagination(query: Record<string, unknown>): CampaignPagination {
  onlyFields(query, ['limit', 'offset']);
  function integer(value: unknown, fallback: number, min: number, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'Invalid pagination');
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max) throw new AppError(400, 'Invalid pagination');
    return result;
  }
  return { limit: integer(query.limit, 50, 1, 100), offset: integer(query.offset, 0, 0, 2147483647) };
}

export function parseCampaignDays(value: unknown): CampaignDay[] {
  if (!Array.isArray(value) || !value.length) throw new AppError(400, 'Select at least one campaign date');
  const dates = new Set<string>();
  const ids = new Set<string>();
  const days = value.map((day: unknown) => {
    if (!object(day)) throw new AppError(400, 'Invalid campaign date');
    onlyFields(day, ['date', 'intervals']);
    const date = day.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) {
      throw new AppError(400, 'Use valid YYYY-MM-DD campaign dates');
    }
    const timestamp = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== date || dates.has(date)) {
      throw new AppError(400, 'Campaign dates must be valid and unique');
    }
    dates.add(date);
    if (!Array.isArray(day.intervals) || !day.intervals.length || day.intervals.length > 96) {
      throw new AppError(400, 'Each campaign day needs 1–96 working intervals');
    }
    const intervals = day.intervals.map((interval: unknown) => {
      if (!object(interval)) throw new AppError(400, 'Invalid working interval');
      onlyFields(interval, ['id', 'start', 'end']);
      if (typeof interval.id !== 'string' || !uuid.test(interval.id) || ids.has(interval.id.toLowerCase())) {
        throw new AppError(400, 'Working interval IDs must be valid and unique');
      }
      const id = interval.id.toLowerCase();
      ids.add(id);
      const { start, end } = interval;
      if (typeof start !== 'number' || typeof end !== 'number' || !Number.isInteger(start) || !Number.isInteger(end)
        || start < 0 || end > 1440 || start >= end || start % 15 !== 0 || end % 15 !== 0) {
        throw new AppError(400, 'Working hours must be same-day, increasing 15-minute intervals between 00:00 and 24:00');
      }
      return { id, start, end };
    }).sort((a, b) => a.start - b.start);
    if (intervals.some((interval, index) => index > 0 && intervals[index - 1].end > interval.start)) {
      throw new AppError(400, 'Working intervals must not overlap');
    }
    return { date, intervals };
  });
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function parseInput(value: unknown, updating: boolean): CampaignInput {
  if (!object(value)) throw new AppError(400, 'A campaign body is required');
  onlyFields(value, updating ? ['name', 'days', 'version'] : ['name', 'days']);
  if (value.name !== undefined && (typeof value.name !== 'string' || value.name.trim().length > 200)) {
    throw new AppError(400, 'Campaign names must be at most 200 characters');
  }
  return { name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Untitled campaign', days: parseCampaignDays(value.days) };
}

export function parseCampaignCreate(value: unknown) {
  return parseInput(value, false);
}

export function parseCampaignUpdate(value: unknown): CampaignUpdate {
  const input = parseInput(value, true);
  if (!object(value) || typeof value.version !== 'number' || !Number.isSafeInteger(value.version)
    || value.version < 1 || value.version >= 2147483647) {
    throw new AppError(400, 'A valid campaign version is required');
  }
  return { ...input, version: value.version };
}

// Both schedules are canonicalized by parseCampaignDays before comparison.
export function checkCampaignPastDays(days: CampaignDay[], saved: CampaignDay[], today = campaignToday()) {
  const past = (schedule: CampaignDay[]) => schedule.filter((day) => day.date < today);
  if (JSON.stringify(past(days)) !== JSON.stringify(past(saved))) {
    throw new AppError(400, 'Past campaign dates and hours cannot change. Restore the saved past schedule before saving.');
  }
}
