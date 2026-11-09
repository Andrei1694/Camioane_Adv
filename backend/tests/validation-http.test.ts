import './helpers/env.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hash } from 'argon2';
import { after, before, describe, it, mock } from 'node:test';
import type { TestServer } from './helpers/api.ts';
import type { RoleName, SessionUser } from '../src/types/user.ts';

interface HttpUser extends SessionUser {
  password: string;
  token: string;
}

// Exercise real routes, authentication, controllers, and the error handler.
// Only persistence is replaced, keeping validation checks independent of SQL.
const users: HttpUser[] = [];
const models = {
  user: {
    async findUnique({ where }: { where: { id?: string; email?: string } }) {
      return users.find((user) => where.id === user.id || where.email === user.email) ?? null;
    },
  },
  car: { async findUnique() { return null; } },
  savedRoute: { async findUnique() { return null; } },
  campaign: { async findUnique() { return null; } },
};
mock.module('../src/lib/prisma.ts', {
  exports: {
    prisma: { ...models, async $transaction<T>(action: (tx: typeof models) => Promise<T>) { return action(models); } },
  },
});
const { startServer, signToken } = await import('./helpers/api.ts');
const password = '  a safe test passphrase  ';
let api: TestServer;
let admin: HttpUser;
let user: HttpUser;

async function fixtureUser(name: RoleName, passwordHash: string): Promise<HttpUser> {
  const id = randomUUID();
  const user = {
    id, email: `${id}@example.test`, password: passwordHash, sessionVersion: 0, avatar: null,
    role: { id: randomUUID(), name, activ: true, startDate: new Date(0), endDate: null },
    token: await signToken(id),
  };
  users.push(user);
  return user;
}

async function expectError(response: Promise<Response>, status: number, error: string) {
  const result = await response;
  assert.equal(result.status, status);
  assert.deepEqual(await result.json(), { error });
}

describe('Request validation responses', { concurrency: false }, () => {
  before(async () => {
    const passwordHash = await hash(password);
    admin = await fixtureUser('ADMIN', passwordHash);
    user = await fixtureUser('USER', passwordHash);
    api = await startServer();
  });

  after(async () => {
    await api?.close();
    users.length = 0;
    mock.restoreAll();
  });

  it('keeps login normalization and acceptance of extra fields', async () => {
    const response = await api.request('POST', '/users/login', {
      body: { email: ` ${user.email.toUpperCase()} `, password, extra: true },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.id, user.id);
  });

  it('returns the same single public message for multiple invalid fields', async () => {
    const cases: [string, unknown, string][] = [
      ['/users', { extra: true }, 'Only email, password, and role can be changed'],
      ['/users', { role: 'bad' }, 'Email must be a string'],
      ['/credits/purchases', { credits: 0, price: 1 }, 'Only credits can be provided'],
      ['/credits/adjustments', { amount: 0, userId: null, note: null }, 'Amount must not be zero'],
      ['/cars', { extra: true }, 'Unsupported car fields'],
      ['/cars', {}, 'License plate must be a string'],
      ['/routes', { name: '', waypoints: [] }, 'Route names must contain 1–200 characters and no null characters'],
      ['/campaigns', { name: 1, days: [] }, 'Campaign names must be at most 200 characters'],
      ['/campaigns', { days: [{ date: '2028-02-30', intervals: [] }] }, 'Campaign dates must be valid and unique'],
    ];
    for (const [path, body, error] of cases) {
      await expectError(api.request('POST', path, { token: admin.token, body }), 400, error);
    }
    await expectError(api.request('PATCH', `/users/${user.id}`, { token: admin.token, body: {} }), 400, 'Provide at least one field to update');
    await expectError(api.request('POST', '/cars', { token: admin.token, body: [] }), 400, 'A JSON object is required');
    await expectError(api.request('POST', '/campaigns', { token: admin.token, body: [] }), 400, 'A campaign body is required');
  });

  it('preserves query restrictions, repeated parameters, and route-ID precedence', async () => {
    const cases = [
      ['/files?limit=1&limit=2', 'Invalid pagination'],
      ['/files?limit=0&extra=1', 'Only limit and offset query parameters are supported'],
      ['/credits/purchases?limit=1&limit=2', 'Invalid pagination'],
      ['/credits/transactions?status=PAID&limit=0', 'Only limit, offset, userId can be provided'],
      ['/cars/bad?extra=1', 'Car endpoints do not accept query parameters'],
      ['/cars/bad', 'A valid car ID is required'],
      ['/routes?limit=1&limit=2', 'Invalid route pagination'],
      ['/routes/bad?extra=1', 'Unsupported route fields'],
      ['/routes/bad', 'A valid route ID is required'],
      ['/campaigns?limit=1&limit=2', 'Invalid pagination'],
      ['/campaigns/bad?extra=1', 'A valid campaign ID is required'],
      ['/files/bad/download', 'A valid file ID is required'],
    ];
    for (const [path, error] of cases) {
      await expectError(api.request('GET', path, { token: admin.token }), 400, error);
    }
    for (const [path, label] of [['/users', 'user'], ['/cars', 'car'], ['/routes', 'route'], ['/campaigns', 'campaign']]) {
      await expectError(api.request('PATCH', `${path}/bad`, { token: admin.token, body: {} }), 400, `A valid ${label} ID is required`);
    }
    for (const [path, label] of [['/cars', 'Car'], ['/routes', 'Route'], ['/campaigns', 'Campaign']]) {
      await expectError(api.request('GET', `${path}/${randomUUID()}`, { token: admin.token }), 404, `${label} not found`);
    }
  });

  it('keeps authentication ahead of body/query validation and JSON parsing ahead of field checks', async () => {
    for (const path of ['/users', '/cars', '/routes', '/campaigns']) {
      const malformed = { body: '{', headers: { 'Content-Type': 'application/json' } };
      await expectError(api.request('POST', `${path}?extra=1`, malformed), 401, 'Unauthorized');
      await expectError(api.request('POST', `${path}?extra=1`, { ...malformed, token: user.token }), 403, 'Administrator access is required');
      await expectError(api.request('POST', path, { ...malformed, token: admin.token }), 400, 'Invalid JSON body');
    }
    await expectError(api.request('POST', '/cars?extra=1', {
      token: admin.token, body: '{', headers: { 'Content-Type': 'application/json' },
    }), 400, 'Car endpoints do not accept query parameters');
    await expectError(api.request('POST', '/routes', {
      token: admin.token, body: { name: 'x'.repeat(17000) },
    }), 413, 'Request body is too large');
  });
});
