import * as z from 'zod';
import { AppError } from './app-error.ts';
import { allowedKeysSchema, integerSchema, objectSchema, parse, queryIntegerSchema, uuidSchema } from './validation.ts';
import type { CampaignDay, CampaignInput, CampaignInterval, CampaignPagination, CampaignUpdate } from '../types/campaign.ts';

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
});
const campaignIdSchema = uuidSchema('A valid campaign ID is required');
const paginationFields = allowedKeysSchema(['limit', 'offset'], 'Unsupported campaign fields');
const limitSchema = queryIntegerSchema(50, 1, 100, 'Invalid pagination');
const offsetSchema = queryIntegerSchema(0, 0, 2147483647, 'Invalid pagination');
const bodySchema = objectSchema('A campaign body is required');
const createFields = allowedKeysSchema(['name', 'days'], 'Unsupported campaign fields');
const updateFields = allowedKeysSchema(['name', 'days', 'version'], 'Unsupported campaign fields');
const nameMessage = 'Campaign names must be at most 200 characters';
const nameSchema = z.string({ error: nameMessage }).trim()
  .refine((name) => name.length <= 200, { error: nameMessage }).optional()
  .transform((name) => name || 'Untitled campaign');
const versionSchema = integerSchema(1, 2147483646, 'A valid campaign version is required');
const daysMessage = 'Select at least one campaign date';
const daysSchema = z.custom<unknown[]>(Array.isArray, { error: daysMessage })
  .refine((days) => days.length > 0, { error: daysMessage });
const daySchema = objectSchema('Invalid campaign date');
const dayFields = allowedKeysSchema(['date', 'intervals'], 'Unsupported campaign fields');
const dateMessage = 'Use valid YYYY-MM-DD campaign dates';
const uniqueDateMessage = 'Campaign dates must be valid and unique';
const dateSchema = z.string({ error: dateMessage })
  .refine((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith('0000'), { error: dateMessage, abort: true })
  .refine((date) => {
    const timestamp = new Date(`${date}T12:00:00.000Z`);
    return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString().slice(0, 10) === date;
  }, { error: uniqueDateMessage });
const intervalsMessage = 'Each campaign day needs 1–96 working intervals';
const intervalsSchema = z.custom<unknown[]>(Array.isArray, { error: intervalsMessage })
  .refine((intervals) => intervals.length > 0 && intervals.length <= 96, { error: intervalsMessage });
const intervalSchema = objectSchema('Invalid working interval');
const intervalFields = allowedKeysSchema(['id', 'start', 'end'], 'Unsupported campaign fields');
const intervalIdMessage = 'Working interval IDs must be valid and unique';
const intervalIdSchema = uuidSchema(intervalIdMessage);
const hoursMessage = 'Working hours must be same-day, increasing 15-minute intervals between 00:00 and 24:00';
const hoursSchema = z.object({
  start: z.number({ error: hoursMessage }),
  end: z.number({ error: hoursMessage }),
}, { error: hoursMessage }).refine(({ start, end }) => Number.isInteger(start) && Number.isInteger(end)
  && start >= 0 && end <= 1440 && start < end && start % 15 === 0 && end % 15 === 0, { error: hoursMessage });
// Items have already been parsed in input order before this cross-item check.
const nonoverlappingSchema = z.custom<CampaignInterval[]>(Array.isArray, { error: 'Working intervals must not overlap' })
  .refine((intervals) => !intervals.some((interval, index) => index > 0 && intervals[index - 1].end > interval.start), {
    error: 'Working intervals must not overlap',
  });

export function campaignToday(now = new Date()) {
  const parts = dateFormat.formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseCampaignId(value: unknown) {
  return parse(campaignIdSchema, value);
}

export function parseCampaignPagination(query: Record<string, unknown>): CampaignPagination {
  parse(paginationFields, query);
  return { limit: parse(limitSchema, query.limit), offset: parse(offsetSchema, query.offset) };
}

export function parseCampaignDays(value: unknown): CampaignDay[] {
  const input = parse(daysSchema, value);
  const dates = new Set<string>();
  const ids = new Set<string>();
  // These refinements belong to this parse only; no state leaks between requests.
  const uniqueDateSchema = dateSchema.refine((date) => !dates.has(date), { error: uniqueDateMessage });
  const uniqueIdSchema = intervalIdSchema.refine((id) => !ids.has(id), { error: intervalIdMessage });
  const days = input.map((value) => {
    const day = parse(dayFields, parse(daySchema, value));
    const date = parse(uniqueDateSchema, day.date);
    dates.add(date);
    const intervals = parse(intervalsSchema, day.intervals).map((value) => {
      const interval = parse(intervalFields, parse(intervalSchema, value));
      const id = parse(uniqueIdSchema, interval.id);
      ids.add(id);
      const { start, end } = parse(hoursSchema, interval);
      return { id, start, end };
    }).sort((a, b) => a.start - b.start);
    return { date, intervals: parse(nonoverlappingSchema, intervals) };
  });
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function parseInput(value: unknown, updating: boolean): CampaignInput {
  const data = parse(updating ? updateFields : createFields, parse(bodySchema, value));
  return { name: parse(nameSchema, data.name), days: parseCampaignDays(data.days) };
}

export function parseCampaignCreate(value: unknown) {
  return parseInput(value, false);
}

export function parseCampaignUpdate(value: unknown): CampaignUpdate {
  const input = parseInput(value, true);
  const data = parse(bodySchema, value);
  return { ...input, version: parse(versionSchema, data.version) };
}

// Both schedules are canonicalized by parseCampaignDays before comparison.
export function checkCampaignPastDays(days: CampaignDay[], saved: CampaignDay[], today = campaignToday()) {
  const past = (schedule: CampaignDay[]) => schedule.filter((day) => day.date < today);
  if (JSON.stringify(past(days)) !== JSON.stringify(past(saved))) {
    throw new AppError(400, 'Past campaign dates and hours cannot change. Restore the saved past schedule before saving.');
  }
}
