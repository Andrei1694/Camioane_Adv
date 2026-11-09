import './helpers/env.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/lib/app-error.ts';
import { parseCarCreate, parseCarId, parseCarUpdate, plateKey, rejectCarQuery } from '../src/lib/car-validation.ts';
import { campaignToday, checkCampaignPastDays, parseCampaignCreate, parseCampaignDays, parseCampaignId, parseCampaignPagination, parseCampaignUpdate } from '../src/lib/campaign-validation.ts';
import { parseAdjustment, parseConfirmPurchase, parseCreditQuery, parsePurchaseId } from '../src/lib/credit-validation.ts';
import { parseFileId, parseFilePagination } from '../src/lib/file-validation.ts';
import { parseRouteCreate, parseRouteId, parseRoutePagination, parseRouteUpdate, parseRouteWaypoints, rejectRouteQuery } from '../src/lib/route-validation.ts';
import { isUserId, parseBody, parseCreateUser, parseCredentials, parseEmail, parseUpdateUser, parseUserId } from '../src/lib/user-validation.ts';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const car = { plate: ' b-12 abc ', makeModel: ' Volvo ', driverName: ' ', routeId: null, status: 'active' };
const route = { name: ' Route ', waypoints: [[-180, -85.051129], [180, 85.051129]] };
const interval = { id, start: 0, end: 15 };
const day = { date: '2028-02-29', intervals: [interval] };
const campaign = { days: [day] };

function rejects(action: () => unknown, message: string) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 400);
    assert.equal(error.message, message);
    return true;
  });
}

describe('Validation compatibility', () => {
  it('retains permissive IDs, normalization, and parser-specific messages', () => {
    const parsers = [
      [parseUserId, 'user'], [parsePurchaseId, 'purchase'], [parseFileId, 'file'],
      [parseCarId, 'car'], [parseRouteId, 'route'], [parseCampaignId, 'campaign'],
    ] as const;
    for (const [parse, label] of parsers) {
      assert.equal(parse(id.toUpperCase()), id);
      assert.equal(parse('00000000-0000-0000-0000-000000000000'), '00000000-0000-0000-0000-000000000000');
      for (const value of [undefined, null, 1, [], '', 'bad', ` ${id}`, `${id}\n`]) {
        rejects(() => parse(value), `A valid ${label} ID is required`);
      }
    }
    assert.equal(isUserId(id), true);
    assert.equal(isUserId({}), false);
  });

  it('retains email rules, body copying, field presence, and user error precedence', () => {
    assert.equal(parseEmail(' A..B@C.D '), 'a..b@c.d');
    assert.equal(parseEmail(`${'😀'.repeat(124)}@x.y`).length, 252);
    rejects(() => parseEmail(`${'😀'.repeat(126)}@x.y`), 'A valid email address is required');
    const body = Object.assign(Object.create({ inherited: true }), { email: 'A@B.C' });
    assert.deepEqual(parseBody(body), { email: 'A@B.C' });
    assert.deepEqual(parseBody(new Date()), {});
    assert.deepEqual(parseBody(JSON.parse('{"__proto__":1}')), JSON.parse('{"__proto__":1}'));
    const credentials = { email: 'A@B.C', password: ' '.repeat(12) };
    assert.deepEqual(parseCredentials({ ...credentials, extra: true }), { email: 'a@b.c', password: credentials.password });
    assert.equal(parseCreateUser({ ...credentials, role: undefined }).role, 'USER');
    for (const field of ['email', 'password', 'role']) {
      const message = field === 'role' ? 'Role must be ADMIN, OPERATOR, DRIVER, or USER' : `${field === 'email' ? 'Email' : 'Password'} must be a string`;
      rejects(() => parseUpdateUser({ [field]: undefined }), message);
    }
    rejects(() => parseCreateUser({ extra: true }), 'Only email, password, and role can be changed');
    rejects(() => parseCreateUser({ role: 'bad' }), 'Email must be a string');
    rejects(() => parseCreateUser({ email: 'a@b.c', role: 'bad' }), 'Password must be a string');
    rejects(() => parseUpdateUser({ role: null, password: null, email: null }), 'Email must be a string');
  });

  it('retains digit-only pagination, defaults, bounds, and unknown-key precedence', () => {
    const parsers = [
      [parseFilePagination, 'Invalid pagination', 'Only limit and offset query parameters are supported'],
      [parseRoutePagination, 'Invalid route pagination', 'Unsupported route fields'],
      [parseCampaignPagination, 'Invalid pagination', 'Unsupported campaign fields'],
      [(query: Record<string, unknown>) => parseCreditQuery(query, { status: false }), 'Invalid pagination', 'Only limit, offset, userId can be provided'],
    ] as const;
    for (const [parse, invalid, unsupported] of parsers) {
      assert.deepEqual(parse({ limit: undefined, offset: undefined }), { limit: 50, offset: 0 });
      assert.deepEqual(parse({ limit: '001', offset: '000' }), { limit: 1, offset: 0 });
      assert.deepEqual(parse({ limit: '100', offset: '2147483647' }), { limit: 100, offset: 2147483647 });
      for (const value of [null, 1, '', ' ', '+1', '-1', '1.0', '1e1', '0x10', '1\n', ['1', '2'], {}, '9'.repeat(400)]) {
        rejects(() => parse({ limit: value }), invalid);
      }
      rejects(() => parse({ offset: '2147483648' }), invalid);
      rejects(() => parse({ limit: '0', extra: true }), unsupported);
    }
    assert.deepEqual(parseConfirmPurchase({ reference: undefined }), {});
    rejects(() => parseAdjustment({ amount: 0, userId: null, note: null }), 'Amount must not be zero');
    rejects(() => parseAdjustment({ amount: null, userId: null, note: null }), 'Amount must be a whole number between -1000000 and 1000000');
    rejects(() => parseAdjustment({ amount: 1, userId: null, note: null }), 'A valid user ID is required');
    assert.deepEqual(parseCreditQuery({ userId: undefined, status: undefined }, { status: true }), { limit: 50, offset: 0 });
  });
});

describe('Car validation', () => {
  it('normalizes text, retains empty drivers, and accepts every route and status', () => {
    assert.deepEqual(parseCarCreate(car), { plate: 'B-12 ABC', makeModel: 'Volvo', driverName: '', routeId: null, status: 'active' });
    assert.equal(plateKey(' b -12 ab c '), 'B12ABC');
    for (const routeId of [null, 'centru', 'nord', 'vest', 'est', 'sud']) {
      for (const status of ['active', 'maintenance', 'inactive']) {
        assert.equal(parseCarCreate({ ...car, routeId, status }).routeId, routeId);
      }
    }
    assert.equal(parseCarCreate({ ...car, makeModel: '😀'.repeat(100), driverName: '😀'.repeat(100) }).makeModel.length, 200);
    assert.equal(parseCarUpdate({ ...car, version: 2147483646 }).version, 2147483646);
    assert.equal(rejectCarQuery({}), undefined);
  });

  it('preserves text errors and validation order', () => {
    rejects(() => parseCarCreate(null), 'A JSON object is required');
    rejects(() => parseCarCreate({ extra: true }), 'Unsupported car fields');
    for (const [field, label, max] of [['plate', 'License plate', 32], ['makeModel', 'Make/model', 200], ['driverName', 'Driver name', 200]] as const) {
      rejects(() => parseCarCreate({ ...car, [field]: null }), `${label} must be a string`);
      for (const value of ['\0', 'x'.repeat(max + 1), '😀'.repeat(max / 2 + 1)]) {
        rejects(() => parseCarCreate({ ...car, [field]: value }), `${label} must contain at most ${max} characters and no null characters`);
      }
      if (field !== 'driverName') rejects(() => parseCarCreate({ ...car, [field]: ' ' }), `${label} is required`);
    }
    rejects(() => parseCarCreate({ ...car, plate: '--', makeModel: null }), 'Enter a license plate');
    rejects(() => parseCarCreate({ ...car, routeId: undefined, status: null }), 'Route must be centru, nord, vest, est, sud, or null');
    rejects(() => parseCarCreate({ ...car, status: 'ACTIVE' }), 'Status must be active, maintenance, or inactive');
    rejects(() => rejectCarQuery({ limit: undefined }), 'Car endpoints do not accept query parameters');
    for (const version of [undefined, null, '1', 0, 1.5, NaN, Infinity, 2147483647]) {
      rejects(() => parseCarUpdate({ ...car, version }), 'A valid car version is required');
    }
    rejects(() => parseCarUpdate({ ...car, plate: '', version: 0 }), 'License plate is required');
    rejects(() => parseCarCreate({ ...car, version: 1 }), 'Unsupported car fields');
  });
});

describe('Saved route validation', () => {
  it('preserves names, coordinate bounds, array sizes, and versions', () => {
    assert.deepEqual(parseRouteCreate(route), { ...route, name: 'Route' });
    assert.equal(parseRouteCreate({ ...route, name: '😀'.repeat(100) }).name.length, 200);
    assert.equal(parseRouteWaypoints(Array.from({ length: 100 }, () => [0, 0])).length, 100);
    assert.equal(parseRouteUpdate({ ...route, version: 1 }).version, 1);
    assert.equal(rejectRouteQuery({}), undefined);
    rejects(() => rejectRouteQuery({ limit: '1' }), 'Unsupported route fields');
    rejects(() => parseRouteCreate([]), 'A JSON object is required');
    rejects(() => parseRouteCreate({ extra: 1 }), 'Unsupported route fields');
    for (const name of [undefined, null, '', ' ', '\0', '😀'.repeat(101)]) {
      rejects(() => parseRouteCreate({ ...route, name, waypoints: null }), 'Route names must contain 1–200 characters and no null characters');
    }
    for (const points of [null, [], [[0, 0]], Array.from({ length: 101 }, () => null)]) {
      rejects(() => parseRouteWaypoints(points), 'A route must have 2–100 stops');
    }
    for (const point of [null, [], [0], [0, 0, 0], ['0', 0], [0, null], [Infinity, 0], [0, NaN], [180.001, 0], [0, 85.05113]]) {
      rejects(() => parseRouteWaypoints([point, [0, 0]]), 'Stops must be [longitude, latitude] pairs within ±180 longitude and ±85.051129 latitude');
    }
    for (const version of [undefined, null, '1', 0, 1.5, Infinity, 2147483647]) {
      rejects(() => parseRouteUpdate({ ...route, version }), 'A valid route version is required');
    }
    rejects(() => parseRouteUpdate({ ...route, version: 0, waypoints: [] }), 'A route must have 2–100 stops');
    rejects(() => parseRouteCreate({ ...route, version: 1 }), 'Unsupported route fields');
  });
});

describe('Campaign validation', () => {
  it('defaults names, sorts without mutating input, and resets uniqueness between calls', () => {
    const days = [
      { date: '2028-03-01', intervals: [{ id: otherId.toUpperCase(), start: 15, end: 1440 }, { ...interval, id: id.toUpperCase() }] },
      { date: '2028-02-29', intervals: [{ ...interval, id: '00000000-0000-0000-0000-000000000000' }] },
    ];
    const original = structuredClone(days);
    const parsed = parseCampaignDays(days);
    assert.deepEqual(parsed.map((item) => item.date), ['2028-02-29', '2028-03-01']);
    assert.deepEqual(parsed[1].intervals.map((item) => item.id), [id, otherId]);
    assert.deepEqual(parseCampaignDays(days), parsed);
    assert.deepEqual(days, original);
    for (const name of [undefined, '', ' ']) assert.equal(parseCampaignCreate({ ...campaign, name }).name, 'Untitled campaign');
    assert.equal(parseCampaignCreate({ ...campaign, name: ' Hi\0 ' }).name, 'Hi\0');
    assert.equal(parseCampaignCreate({ ...campaign, name: '😀'.repeat(100) }).name.length, 200);
    assert.equal(parseCampaignUpdate({ ...campaign, version: 2147483646 }).version, 2147483646);
    const intervals = Array.from({ length: 96 }, (_, i) => ({ id: `${i.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`, start: i * 15, end: (i + 1) * 15 }));
    assert.equal(parseCampaignDays([{ ...day, intervals }])[0].intervals.length, 96);
  });

  it('preserves body, name, date, and version failures in order', () => {
    for (const value of [undefined, null, [], 1]) rejects(() => parseCampaignCreate(value), 'A campaign body is required');
    rejects(() => parseCampaignCreate({ extra: true }), 'Unsupported campaign fields');
    for (const name of [null, 1, '😀'.repeat(101)]) rejects(() => parseCampaignCreate({ name, days: null }), 'Campaign names must be at most 200 characters');
    for (const value of [null, {}, []]) rejects(() => parseCampaignDays(value), 'Select at least one campaign date');
    for (const value of [null, [], 'date']) rejects(() => parseCampaignDays([value]), 'Invalid campaign date');
    rejects(() => parseCampaignDays([{ extra: 1 }]), 'Unsupported campaign fields');
    for (const date of [null, '', '2028-2-29', '0000-01-01', '2028-01-01\n']) {
      rejects(() => parseCampaignDays([{ date, intervals: null }]), 'Use valid YYYY-MM-DD campaign dates');
    }
    for (const date of ['2027-02-29', '2028-02-30', '2028-13-01']) {
      rejects(() => parseCampaignDays([{ date, intervals: null }]), 'Campaign dates must be valid and unique');
    }
    rejects(() => parseCampaignDays([day, { ...day, intervals: null }]), 'Campaign dates must be valid and unique');
    for (const version of [undefined, null, '1', 0, 1.5, Infinity, 2147483647]) {
      rejects(() => parseCampaignUpdate({ ...campaign, version }), 'A valid campaign version is required');
    }
    rejects(() => parseCampaignUpdate({ days: [], version: 0 }), 'Select at least one campaign date');
    rejects(() => parseCampaignCreate({ ...campaign, version: 1 }), 'Unsupported campaign fields');
  });

  it('preserves nested schedule failures and input-order precedence', () => {
    for (const intervals of [null, [], Array(97).fill(null)]) {
      rejects(() => parseCampaignDays([{ ...day, intervals }]), 'Each campaign day needs 1–96 working intervals');
    }
    for (const value of [null, [], 1]) rejects(() => parseCampaignDays([{ ...day, intervals: [value] }]), 'Invalid working interval');
    rejects(() => parseCampaignDays([{ ...day, intervals: [{ extra: true }] }]), 'Unsupported campaign fields');
    for (const value of [null, 1, 'bad']) rejects(() => parseCampaignDays([{ ...day, intervals: [{ id: value }] }]), 'Working interval IDs must be valid and unique');
    rejects(() => parseCampaignDays([day, { date: '2028-03-01', intervals: [{ ...interval, id: id.toUpperCase(), start: -1 }] }]), 'Working interval IDs must be valid and unique');
    for (const [start, end] of [[null, 15], [0, '15'], [-15, 15], [0, 1441], [15, 15], [30, 15], [1, 15], [0, 16], [0.5, 15], [NaN, 15], [0, Infinity]]) {
      rejects(() => parseCampaignDays([{ ...day, intervals: [{ ...interval, start, end }] }]), 'Working hours must be same-day, increasing 15-minute intervals between 00:00 and 24:00');
    }
    const overlap = { ...day, intervals: [{ ...interval, end: 30 }, { id: otherId, start: 15, end: 45 }] };
    rejects(() => parseCampaignDays([overlap, null]), 'Working intervals must not overlap');
    rejects(() => parseCampaignDays([{ ...overlap, intervals: [...overlap.intervals, null] }]), 'Invalid working interval');
    assert.deepEqual(parseCampaignDays([day]), [day]);
  });

  it('keeps Bucharest midnight boundaries and canonical past-schedule protection', () => {
    assert.equal(campaignToday(new Date('2028-01-01T21:59:59Z')), '2028-01-01');
    assert.equal(campaignToday(new Date('2028-01-01T22:00:00Z')), '2028-01-02');
    assert.equal(campaignToday(new Date('2028-07-01T21:00:00Z')), '2028-07-02');
    assert.match(campaignToday(), /^\d{4}-\d{2}-\d{2}$/);
    checkCampaignPastDays([day], [day], '2028-03-01');
    checkCampaignPastDays([], [day], '2028-02-29');
    checkCampaignPastDays([], []);
    rejects(() => checkCampaignPastDays([], [day], '2028-03-01'), 'Past campaign dates and hours cannot change. Restore the saved past schedule before saving.');
  });
});
