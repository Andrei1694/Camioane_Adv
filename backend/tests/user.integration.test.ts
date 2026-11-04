import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { verify } from 'argon2';
import express from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';

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

function fixtureEmail() {
  const email = `auth-test-${randomUUID()}@example.test`;
  fixtureEmails.add(email);
  return email;
}

async function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function register(email = fixtureEmail(), userPassword = password) {
  const response = await post('/users/register', { email, password: userPassword });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['accessToken', 'expiresIn', 'tokenType', 'user']);
  assert.deepEqual(data.user, { email: email.trim().toLowerCase() });
  assert.equal(typeof data.accessToken, 'string');
  assert.equal(data.tokenType, 'Bearer');
  assert.equal(data.expiresIn, 3600);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { email: data.user.email as string, token: data.accessToken as string };
}

async function getMe(token?: string) {
  return fetch(`${baseUrl}/users/me`, {
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  });
}

async function signToken(email: string, claims: JWTPayload = {}, algorithm = 'HS256', key = secret) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: email,
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

describe('User authentication API', { concurrency: false }, () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
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

  it('registers, normalizes email, stores a salted hash, and signs a one-hour JWT', async () => {
    const email = fixtureEmail();
    const { token } = await register(`  ${email.toUpperCase()}  `);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.notEqual(stored.password, password);
    assert.match(stored.password, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal(await verify(stored.password, password), true);
    assert.equal(await verify(stored.password, password.trim()), false);

    const second = await register();
    const secondStored = await prisma.user.findUniqueOrThrow({ where: { email: second.email } });
    assert.notEqual(stored.password, secondStored.password);

    const { payload, protectedHeader } = await jwtVerify(token, secret, {
      algorithms: ['HS256'], issuer: 'camioane-api', audience: 'camioane-frontend',
    });
    assert.equal(protectedHeader.typ, 'JWT');
    assert.equal(payload.sub, email);
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp! - payload.iat!, 3600);
    assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'sub']);

    const me = await getMe(token);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { email } });
    assert.equal(me.headers.get('cache-control'), 'no-store');
  });

  it('logs in using normalized email and preserves password whitespace', async () => {
    const { email } = await register();
    const response = await post('/users/login', { email: ` ${email.toUpperCase()} `, password });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data).sort(), ['accessToken', 'expiresIn', 'tokenType', 'user']);
    assert.deepEqual(data.user, { email });
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.expiresIn, 3600);
    const me = await getMe(data.accessToken);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { email } });

    const trimmed = await post('/users/login', { email, password: password.trim() });
    assert.equal(trimmed.status, 401);
    assert.deepEqual(await trimmed.json(), { error: 'Invalid email or password' });
  });

  it('returns the same error for incorrect passwords and unknown emails', async () => {
    const { email } = await register();
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
    const { email } = await register();
    const response = await post('/users/register', {
      email: ` ${email.toUpperCase()} `, password: 'a different password',
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Email is already registered' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(await verify(stored.password, password), true);
  });

  it('handles concurrent registration through the database unique constraint', async () => {
    const email = fixtureEmail();
    const responses = await Promise.all([
      post('/users/register', { email, password }),
      post('/users/register', { email: email.toUpperCase(), password }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    for (const response of responses) {
      const data = await response.json();
      if (response.status === 409) assert.deepEqual(data, { error: 'Email is already registered' });
      else assert.deepEqual(data.user, { email });
    }
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  for (const path of ['/users/register', '/users/login']) {
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
        const response = await post(path, body);
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
      const { email } = await register(fixtureEmail(), boundaryPassword);
      const response = await post('/users/login', { email, password: boundaryPassword });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).user, { email });
    }
  });

  it('returns JSON errors for malformed, absent, and oversized bodies', async () => {
    const malformed = await fetch(`${baseUrl}/users/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON body' });

    const absent = await fetch(`${baseUrl}/users/login`, { method: 'POST' });
    assert.equal(absent.status, 400);
    assert.deepEqual(await absent.json(), { error: 'Email and password must be strings' });

    const oversized = await post('/users/register', { email: fixtureEmail(), password: 'x'.repeat(17000) });
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
    const { email, token } = await register();
    const parts = token.split('.');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    const now = Math.floor(Date.now() / 1000);
    const invalidTokens = [
      parts.join('.'),
      await signToken(email, { exp: now - 1 }),
      await signToken(email, { iss: 'another-api' }),
      await signToken(email, { aud: 'another-client' }),
      await signToken(email, { sub: '' }),
      await signToken(email, { sub: undefined }),
      await signToken(email, { exp: undefined }),
      await signToken(email, { iat: undefined }),
      await signToken(email, { iat: now + 60 }),
      await signToken(email, { iat: now - 3601 }),
      await signToken(email, {}, 'HS384'),
      await signToken(email, {}, 'HS256', randomBytes(32)),
    ];
    for (const invalid of invalidTokens) {
      const response = await getMe(invalid);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    }
  });

  it('rejects an otherwise valid token after its user is deleted', async () => {
    const { email, token } = await register();
    await prisma.user.delete({ where: { email } });
    const response = await getMe(token);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  });

  it('shares the 20-request limit across registration and login without limiting /me', async () => {
    const { token } = await register();
    for (let request = 1; request < 20; request++) {
      const response = await post(request % 2 ? '/users/login' : '/users/register', {});
      assert.equal(response.status, 400);
      await response.json();
    }
    for (const path of ['/users/register', '/users/login']) {
      const response = await post(path, {});
      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), { error: 'Too many authentication requests. Try again later.' });
      assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    const me = await getMe(token);
    assert.equal(me.status, 200);
    await me.json();
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
      ['/users', 404, { error: 'Route not found' }],
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
