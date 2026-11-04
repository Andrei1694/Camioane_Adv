import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { hash, verify } from 'argon2';
import express from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import type { AuthenticationData, PublicUser, RoleName } from '../src/types/user.ts';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const { createApp } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
const { errorHandler } = await import('../src/middleware/error-handler.ts');
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const password = '  a safe test passphrase  ';
const fixtureEmails = new Set<string>();
let server: Server;
let baseUrl: string;
let adminRoleId: string;
let fixturePasswordHash: string;
let administrator: PublicUser;
let adminToken: string;

function fixtureEmail() {
  const email = `auth-test-${randomUUID()}@example.test`;
  fixtureEmails.add(email);
  return email;
}

async function request(method: string, path: string, body?: unknown, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function post(path: string, body: unknown, token?: string) {
  return request('POST', path, body, token);
}

async function login(email: string, userPassword = password) {
  const response = await post('/users/login', { email, password: userPassword });
  assert.equal(response.status, 200);
  const data: AuthenticationData = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['accessToken', 'expiresIn', 'tokenType', 'user']);
  assert.equal(typeof data.accessToken, 'string');
  assert.equal(data.tokenType, 'Bearer');
  assert.equal(data.expiresIn, 3600);
  return data;
}

async function createAccount(email = fixtureEmail(), userPassword = password, role?: RoleName) {
  const response = await post('/users', {
    email, password: userPassword, ...(role === undefined ? {} : { role }),
  }, adminToken);
  assert.equal(response.status, 201);
  const data: { user: PublicUser } = await response.json();
  assert.deepEqual(Object.keys(data), ['user']);
  assert.match(data.user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual(data.user, {
    id: data.user.id, email: email.trim().toLowerCase(), role: role ?? 'USER',
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const authentication = await login(data.user.email, userPassword);
  assert.deepEqual(authentication.user, data.user);
  return { ...data.user, token: authentication.accessToken };
}

async function getMe(token?: string) {
  return fetch(`${baseUrl}/users/me`, {
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  });
}

async function signToken(id: string, claims: JWTPayload = {}, algorithm = 'HS256', key = secret) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: id,
    sessionVersion: 0,
    iss: 'camioane-api',
    aud: 'camioane-frontend',
    iat: now,
    exp: now + 3600,
    ...claims,
  }).setProtectedHeader({ alg: algorithm, typ: 'JWT' }).sign(key);
}

async function closeServer(activeServer: Server) {
  await new Promise<void>((resolve, reject) => {
    activeServer.close((error) => error ? reject(error) : resolve());
  });
}

describe('User authentication and management API', { concurrency: false }, () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
    const role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const now = new Date();
    assert.ok(role && role.activ && role.startDate <= now && (role.endDate === null || now < role.endDate),
      'Integration tests require the migrated development database with an active ADMIN role');
    adminRoleId = role.id;
    fixturePasswordHash = await hash(password);
  });

  beforeEach(async () => {
    const email = fixtureEmail();
    const user = await prisma.user.create({
      data: { email, password: fixturePasswordHash, roleId: adminRoleId },
    });
    administrator = { id: user.id, email, role: 'ADMIN' };
    // Seed only a disposable administrator; setup must not consume login limits.
    adminToken = await signToken(user.id, { sessionVersion: user.sessionVersion });
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    try {
      if (server?.listening) await closeServer(server);
    } finally {
      if (fixtureEmails.size > 0) {
        await prisma.user.deleteMany({ where: { email: { in: [...fixtureEmails] } } });
        fixtureEmails.clear();
      }
    }
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('creates users through an administrator, hashes passwords, and signs UUID/session-version JWTs', async () => {
    const email = fixtureEmail();
    const { id, token } = await createAccount(`  ${email.toUpperCase()}  `);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.notEqual(stored.password, password);
    assert.match(stored.password, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal(await verify(stored.password, password), true);
    assert.equal(await verify(stored.password, password.trim()), false);

    const second = await createAccount();
    const secondStored = await prisma.user.findUniqueOrThrow({ where: { email: second.email } });
    assert.notEqual(stored.password, secondStored.password);

    const { payload, protectedHeader } = await jwtVerify(token, secret, {
      algorithms: ['HS256'], issuer: 'camioane-api', audience: 'camioane-frontend',
    });
    assert.equal(protectedHeader.typ, 'JWT');
    assert.equal(payload.sub, id);
    assert.equal(payload.sessionVersion, stored.sessionVersion);
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp! - payload.iat!, 3600);
    assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'sessionVersion', 'sub']);

    const me = await getMe(token);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { id, email, role: 'USER' } });
    assert.equal(me.headers.get('cache-control'), 'no-store');
    const adminMe = await getMe(adminToken);
    assert.equal(adminMe.status, 200);
    assert.deepEqual(await adminMe.json(), { user: administrator });
  });

  it('logs in using normalized email and preserves password whitespace', async () => {
    const { id, email } = await createAccount();
    const response = await post('/users/login', { email: ` ${email.toUpperCase()} `, password });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data).sort(), ['accessToken', 'expiresIn', 'tokenType', 'user']);
    assert.deepEqual(data.user, { id, email, role: 'USER' });
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.expiresIn, 3600);
    const me = await getMe(data.accessToken);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { id, email, role: 'USER' } });

    const trimmed = await post('/users/login', { email, password: password.trim() });
    assert.equal(trimmed.status, 401);
    assert.deepEqual(await trimmed.json(), { error: 'Invalid email or password' });
  });

  it('returns the same error for incorrect passwords and unknown emails', async () => {
    const { email } = await createAccount();
    for (const credentials of [
      { email, password: 'incorrect password' },
      { email: fixtureEmail(), password },
    ]) {
      const response = await post('/users/login', credentials);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Invalid email or password' });
    }
  });

  it('rejects case-insensitive duplicates without changing the existing password', async () => {
    const { email } = await createAccount();
    const response = await post('/users', {
      email: ` ${email.toUpperCase()} `, password: 'a different password',
    }, adminToken);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Email is already registered' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(await verify(stored.password, password), true);
  });

  it('handles concurrent account creation without duplicate emails', async () => {
    const email = fixtureEmail();
    const responses = await Promise.all([
      post('/users', { email, password }, adminToken),
      post('/users', { email: email.toUpperCase(), password }, adminToken),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    for (const response of responses) {
      const data = await response.json();
      if (response.status === 409) assert.deepEqual(data, { error: 'Email is already registered' });
      else assert.deepEqual(data.user, { id: data.user.id, email, role: 'USER' });
    }
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  for (const path of ['/users', '/users/login']) {
    it(`validates credential bodies at ${path}`, async () => {
      const email = fixtureEmail();
      const invalidBodies = [
        null, [], {}, { email }, { email, password: 12345 }, { email: 42, password },
        { email: '', password }, { email: 'not-an-email', password },
        { email: 'two@@example.test', password },
        { email, password: 'x'.repeat(11) }, { email, password: 'x'.repeat(129) },
        { email, password: '😀'.repeat(11) },
      ];
      for (const body of invalidBodies) {
        const response = await post(path, body, path === '/users' ? adminToken : undefined);
        assert.equal(response.status, 400);
        const data = await response.json();
        assert.deepEqual(Object.keys(data), ['error']);
        assert.equal(typeof data.error, 'string');
      }
      assert.equal(await prisma.user.count({ where: { email } }), 0);
    });
  }

  it('accepts password length boundaries and counts Unicode characters', async () => {
    for (const boundaryPassword of ['x'.repeat(12), '😀'.repeat(128)]) {
      const { id, email } = await createAccount(fixtureEmail(), boundaryPassword);
      const response = await post('/users/login', { email, password: boundaryPassword });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).user, { id, email, role: 'USER' });
    }
  });

  it('returns JSON errors for malformed, absent, and oversized bodies', async () => {
    const malformed = await fetch(`${baseUrl}/users/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON body' });

    const absent = await fetch(`${baseUrl}/users/login`, { method: 'POST' });
    assert.equal(absent.status, 400);
    assert.deepEqual(await absent.json(), { error: 'A JSON object is required' });

    const oversized = await post('/users/login', { email: fixtureEmail(), password: 'x'.repeat(17000) });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: 'Request body is too large' });
  });

  it('rejects missing and malformed bearer headers', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearer abc def', 'Bearer not.a.jwt']) {
      const response = await fetch(`${baseUrl}/users/me`, {
        headers: authorization === undefined ? {} : { Authorization: authorization },
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    }
  });

  it('rejects expired, tampered, wrongly scoped, and incomplete tokens', async () => {
    const { id, email, token } = await createAccount();
    assert.equal((await getMe(await signToken(id))).status, 200);
    const parts = token.split('.');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    const now = Math.floor(Date.now() / 1000);
    const invalidTokens = [
      parts.join('.'),
      await signToken(id, { exp: now - 1 }),
      await signToken(id, { iss: 'another-api' }),
      await signToken(id, { aud: 'another-client' }),
      await signToken(id, { sub: '' }),
      await signToken(id, { sub: undefined }),
      await signToken(id, { sub: email }),
      await signToken(id, { sub: randomUUID() }),
      await signToken(id, { exp: undefined }),
      await signToken(id, { iat: undefined }),
      await signToken(id, { iat: now + 60 }),
      await signToken(id, { iat: now - 3601 }),
      await signToken(id, { sessionVersion: undefined }),
      await signToken(id, { sessionVersion: -1 }),
      await signToken(id, { sessionVersion: 0.5 }),
      await signToken(id, { sessionVersion: '0' }),
      await signToken(id, { sessionVersion: 1 }),
      await signToken(id, {}, 'HS384'),
      await signToken(id, {}, 'HS256', randomBytes(32)),
    ];
    for (const invalid of invalidTokens) {
      const response = await getMe(invalid);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    }
  });

  it('revokes deleted accounts and isolates a replacement with the same email', async () => {
    const { id, email, token } = await createAccount();
    const deleted = await request('DELETE', `/users/${id}`, undefined, adminToken);
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');
    assert.equal(await prisma.user.findUnique({ where: { id } }), null);
    const response = await getMe(token);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    const replacement = await createAccount(email);
    assert.notEqual(replacement.id, id);
    assert.equal((await getMe(token)).status, 401);
    assert.equal((await getMe(replacement.token)).status, 200);
  });

  it('limits successful and failed logins without limiting profile or management routes', async () => {
    const { token } = await createAccount();
    for (let request = 1; request < 20; request++) {
      const response = await post('/users/login', {});
      assert.equal(response.status, 400);
      await response.json();
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await post('/users/login', {});
      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), { error: 'Too many authentication requests. Try again later.' });
      assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    const me = await getMe(token);
    assert.equal(me.status, 200);
    await me.json();
    const created = await post('/users', { email: fixtureEmail(), password }, adminToken);
    assert.equal(created.status, 201);
    await created.json();
    assert.equal((await request('GET', '/users', undefined, adminToken)).status, 200);
    assert.equal((await post('/users/register', {})).status, 404);
  });

  it('keeps public registration unavailable without creating an account', async () => {
    const email = fixtureEmail();
    const response = await post('/users/register', { email, password });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Route not found' });
    assert.equal(await prisma.user.count({ where: { email } }), 0);
  });

  it('requires authentication and administrator access for every management route', async () => {
    const target = await createAccount();
    for (const role of [undefined, 'USER', 'OPERATOR', 'DRIVER'] as const) {
      const account = role === undefined ? undefined : await createAccount(fixtureEmail(), password, role);
      if (account) {
        const profile = await getMe(account.token);
        assert.equal(profile.status, 200);
        assert.deepEqual(await profile.json(), { user: { id: account.id, email: account.email, role } });
      }
      for (const [method, path, body] of [
        ['GET', '/users', undefined],
        ['POST', '/users', { email: fixtureEmail(), password }],
        ['PATCH', `/users/${target.id}`, { role: 'ADMIN' }],
        ['DELETE', `/users/${target.id}`, undefined],
      ] as const) {
        const response = await request(method, path, body, account?.token);
        assert.equal(response.status, account ? 403 : 401);
        assert.deepEqual(await response.json(), {
          error: account ? 'Administrator access is required' : 'Unauthorized',
        });
      }
    }
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, include: { role: true } });
    assert.equal(stored.role.name, 'USER');
    assert.equal(stored.sessionVersion, 0);
  });

  it('lists public user fields and supports every assignable role', async () => {
    const accounts = [];
    for (const role of ['ADMIN', 'OPERATOR', 'DRIVER', 'USER'] as const) {
      const { token, ...user } = await createAccount(fixtureEmail(), password, role);
      accounts.push(user);
      const profile = await getMe(token);
      assert.equal(profile.status, 200);
      assert.deepEqual(await profile.json(), { user });
    }
    const response = await request('GET', '/users', undefined, adminToken);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data: { users: PublicUser[] } = await response.json();
    assert.deepEqual(Object.keys(data), ['users']);
    assert.ok(Array.isArray(data.users));
    for (const user of data.users) assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'role']);
    const fixtures = data.users.filter(user => fixtureEmails.has(user.email));
    assert.deepEqual(fixtures, [...accounts, administrator].sort((left, right) => left.email.localeCompare(right.email)));
  });

  for (const field of ['email', 'password', 'role'] as const) {
    it(`revokes existing sessions after an administrator changes ${field}`, async () => {
      const account = await createAccount();
      const email = field === 'email' ? fixtureEmail() : account.email;
      const userPassword = field === 'password' ? 'a different safe password' : password;
      const role = field === 'role' ? 'OPERATOR' : 'USER';
      const change = { [field]: { email, password: userPassword, role }[field] };
      const response = await request('PATCH', `/users/${account.id}`, change, adminToken);
      assert.equal(response.status, 200);
      const expected = { id: account.id, email, role };
      assert.deepEqual(await response.json(), { user: expected });
      const revoked = await getMe(account.token);
      assert.equal(revoked.status, 401);
      assert.deepEqual(await revoked.json(), { error: 'Unauthorized' });
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
      assert.equal(stored.sessionVersion, 1);
      assert.equal(await verify(stored.password, userPassword), true);
      if (field !== 'role') {
        const oldCredentials = await post('/users/login', { email: account.email, password });
        assert.equal(oldCredentials.status, 401);
      }
      const authentication = await login(email, userPassword);
      assert.deepEqual(authentication.user, expected);
      const { payload } = await jwtVerify(authentication.accessToken, secret, {
        algorithms: ['HS256'], issuer: 'camioane-api', audience: 'camioane-frontend',
      });
      assert.equal(payload.sub, account.id);
      assert.equal(payload.sessionVersion, 1);
      const profile = await getMe(authentication.accessToken);
      assert.equal(profile.status, 200);
      assert.deepEqual(await profile.json(), { user: expected });
    });
  }

  it('keeps passwords and sessions when an update makes no effective change', async () => {
    const account = await createAccount();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    const response = await request('PATCH', `/users/${account.id}`, {
      email: ` ${account.email.toUpperCase()} `, role: account.role,
    }, adminToken);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: { id: account.id, email: account.email, role: account.role } });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    assert.equal(after.password, before.password);
    assert.equal(after.sessionVersion, before.sessionVersion);
    assert.equal((await getMe(account.token)).status, 200);
  });

  it('rejects invalid management fields and empty updates without changing users', async () => {
    const account = await createAccount();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    for (const body of [
      {}, null, [], { password: '' }, { email: 'invalid' }, { role: 'OWNER' },
      { role: 'admin' }, { role: null }, { id: randomUUID() }, { sessionVersion: 0 },
    ]) {
      const response = await request('PATCH', `/users/${account.id}`, body, adminToken);
      assert.equal(response.status, 400);
      assert.deepEqual(Object.keys(await response.json()), ['error']);
    }
    const email = fixtureEmail();
    for (const extra of [{ role: 'OWNER' }, { role: null }, { sessionVersion: 0 }]) {
      const response = await post('/users', { email, password, ...extra }, adminToken);
      assert.equal(response.status, 400);
      assert.deepEqual(Object.keys(await response.json()), ['error']);
    }
    assert.equal(await prisma.user.count({ where: { email } }), 0);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: account.id } }), before);
  });

  it('rejects duplicate update emails without revoking the original session', async () => {
    const account = await createAccount();
    const other = await createAccount();
    const response = await request('PATCH', `/users/${account.id}`, { email: other.email.toUpperCase() }, adminToken);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Email is already registered' });
    const profile = await getMe(account.token);
    assert.equal(profile.status, 200);
    assert.deepEqual(await profile.json(), { user: { id: account.id, email: account.email, role: 'USER' } });
  });

  it('distinguishes malformed and missing IDs for updates and deletion', async () => {
    for (const [id, status, error] of [
      ['bad-id', 400, 'A valid user ID is required'],
      [randomUUID(), 404, 'User not found'],
    ] as const) {
      for (const method of ['PATCH', 'DELETE']) {
        const response = await request(method, `/users/${id}`, method === 'PATCH' ? { role: 'USER' } : undefined, adminToken);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { error });
      }
    }
  });

  it('prevents administrator self-deletion and demotion', async () => {
    const deleted = await request('DELETE', `/users/${administrator.id}`, undefined, adminToken);
    assert.equal(deleted.status, 409);
    assert.deepEqual(await deleted.json(), { error: 'You cannot delete your own account' });
    for (const role of ['USER', 'OPERATOR', 'DRIVER']) {
      const response = await request('PATCH', `/users/${administrator.id}`, { role }, adminToken);
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'You cannot remove your own administrator access' });
    }
    const profile = await getMe(adminToken);
    assert.equal(profile.status, 200);
    assert.deepEqual(await profile.json(), { user: administrator });
  });

  it('allows the configured browser origin and required request headers', async () => {
    const response = await fetch(`${baseUrl}/users/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type,Authorization');
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    const otherOrigin = 'https://untrusted.example';
    const denied = await fetch(`${baseUrl}/health`, { headers: { Origin: otherOrigin } });
    assert.notEqual(denied.headers.get('access-control-allow-origin'), otherOrigin);
    await denied.json();
  });

  it('preserves the API root, health response, and JSON 404 behavior', async () => {
    for (const [path, status, expected] of [
      ['/', 200, { message: 'Camioane API' }],
      ['/health', 200, { status: 'ok' }],
      ['/missing', 404, { error: 'Route not found' }],
      ['/users', 401, { error: 'Unauthorized' }],
    ] as const) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), expected);
      assert.equal(response.headers.get('x-powered-by'), null);
    }
  });

  it('hides internal error details in centralized JSON responses', async () => {
    const application = express();
    application.get('/failure', () => { throw new Error('private database or credential details'); });
    application.use(errorHandler);
    const failureServer = application.listen(0, '127.0.0.1');
    try {
      await once(failureServer, 'listening');
      const address = failureServer.address();
      assert.ok(address && typeof address !== 'string');
      const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'Internal server error' });
    } finally {
      await closeServer(failureServer);
    }
  });
});
