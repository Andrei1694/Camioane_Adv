import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { verify } from 'argon2';
import { jwtVerify } from 'jose';
import { secret, signToken, startServer } from './helpers/api.ts';
import type { RequestOptions, TestServer } from './helpers/api.ts';
import { Fixtures, password, requireDatabase } from './helpers/fixtures.ts';
import { driverConflict, failTransactions, knownError, overrideTransactions } from './helpers/prisma.ts';
import { tempStorage } from './helpers/storage.ts';
import type { TempStorage } from './helpers/storage.ts';
import { prisma } from '../src/lib/prisma.ts';
import { bootstrapAdministrator, createUser, deleteUser, listUsers, updateUser } from '../src/services/user.service.ts';
import type { AuthenticationData, PublicUser, RoleName } from '../src/types/user.ts';

const fixtures = new Fixtures();
let api: TestServer;
let storage: TempStorage;
let administrator: PublicUser;
let adminToken: string;

function fixtureEmail() {
  return fixtures.email('auth-test');
}

function request(method: string, path: string, body?: unknown, token?: string) {
  const options: RequestOptions = {};
  if (body !== undefined) options.body = body;
  if (token !== undefined) options.token = token;
  return api.request(method, path, options);
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
    id: data.user.id, email: email.trim().toLowerCase(), role: role ?? 'USER', avatar: null,
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const authentication = await login(data.user.email, userPassword);
  assert.deepEqual(authentication.user, data.user);
  return { ...data.user, token: authentication.accessToken };
}

async function getMe(token?: string) {
  return request('GET', '/users/me', undefined, token);
}

async function addAvatar(userId: string) {
  const key = randomUUID();
  await storage.storage.inner.put({ key, body: Readable.from(['avatar']), contentType: 'image/webp' });
  const avatar = await prisma.userAvatar.create({
    data: { userId, storageProvider: storage.storage.name, storageKey: key, mimeType: 'image/webp', size: 6 },
  });
  return { key, updatedAt: avatar.updatedAt.toISOString() };
}

describe('User authentication and management API', { concurrency: false }, () => {
  before(async () => {
    await requireDatabase();
    storage = await tempStorage();
  });

  beforeEach(async () => {
    // Seed only a disposable administrator; setup must not consume login limits.
    const admin = await fixtures.user('ADMIN', fixtureEmail());
    administrator = { id: admin.id, email: admin.email, role: 'ADMIN', avatar: null };
    adminToken = admin.token;
    storage.storage.reset();
    api = await startServer({ fileStorage: storage.registry });
  });

  afterEach(async () => {
    try {
      await api?.close();
    } finally {
      await fixtures.cleanup();
      await storage.remove();
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
    assert.deepEqual(await me.json(), { user: { id, email, role: 'USER', avatar: null } });
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
    assert.deepEqual(data.user, { id, email, role: 'USER', avatar: null });
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.expiresIn, 3600);
    const me = await getMe(data.accessToken);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { user: { id, email, role: 'USER', avatar: null } });

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
      else assert.deepEqual(data.user, { id: data.user.id, email, role: 'USER', avatar: null });
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
      assert.deepEqual((await response.json()).user, { id, email, role: 'USER', avatar: null });
    }
  });

  it('returns JSON errors for malformed, absent, and oversized bodies', async () => {
    const malformed = await api.request('POST', '/users/login', { body: '{bad json', headers: { 'Content-Type': 'application/json' } });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON body' });

    const absent = await api.request('POST', '/users/login');
    assert.equal(absent.status, 400);
    assert.deepEqual(await absent.json(), { error: 'A JSON object is required' });

    const oversized = await post('/users/login', { email: fixtureEmail(), password: 'x'.repeat(17000) });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: 'Request body is too large' });
  });

  it('rejects missing and malformed bearer headers', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearer abc def', 'Bearer not.a.jwt']) {
      const response = await api.request('GET', '/users/me', {
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
        assert.deepEqual(await profile.json(), { user: { id: account.id, email: account.email, role, avatar: null } });
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
    for (const user of data.users) assert.deepEqual(Object.keys(user).sort(), ['avatar', 'email', 'id', 'role']);
    const listed = data.users.filter(user => fixtures.emails.has(user.email));
    assert.deepEqual(listed, [...accounts, administrator].sort((left, right) => left.email.localeCompare(right.email)));
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
      const expected = { id: account.id, email, role, avatar: null };
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
    assert.deepEqual(await response.json(), { user: { id: account.id, email: account.email, role: account.role, avatar: null } });
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
    assert.deepEqual(await profile.json(), { user: { id: account.id, email: account.email, role: 'USER', avatar: null } });
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

  it('includes profile pictures in the profile and the user list', async () => {
    const account = await createAccount();
    const avatar = await addAvatar(account.id);
    const expected = { id: account.id, email: account.email, role: 'USER', avatar: { url: `/users/${account.id}/avatar`, updatedAt: avatar.updatedAt } };
    const profile = await getMe(account.token);
    assert.deepEqual(await profile.json(), { user: expected });
    const list = await request('GET', '/users', undefined, adminToken);
    const { users }: { users: PublicUser[] } = await list.json();
    assert.deepEqual(users.find((user) => user.id === account.id), expected);
  });

  it('deletes a removed account\'s profile picture, and still succeeds if that fails', async (t) => {
    const first = await createAccount();
    const { key } = await addAvatar(first.id);
    const deleted = await request('DELETE', `/users/${first.id}`, undefined, adminToken);
    assert.equal(deleted.status, 204);
    assert.deepEqual(storage.storage.deleted, [key]);
    assert.deepEqual(await storage.keys(), []);

    const second = await createAccount();
    const orphan = await addAvatar(second.id);
    const logged = t.mock.method(console, 'error', () => {});
    storage.storage.beforeDelete = () => {
      throw new Error('storage offline');
    };
    const response = await request('DELETE', `/users/${second.id}`, undefined, adminToken);
    assert.equal(response.status, 204);
    assert.equal(await prisma.user.findUnique({ where: { id: second.id } }), null);
    assert.deepEqual(await storage.keys(), [orphan.key]);
    assert.deepEqual(logged.mock.calls.map((call) => call.arguments), [['Failed to delete a stored profile picture']]);
    await storage.storage.inner.delete(orphan.key);
  });

  it('demotes another administrator while one remains, and revokes their sessions', async () => {
    const other = await createAccount(fixtureEmail(), password, 'ADMIN');
    const response = await request('PATCH', `/users/${other.id}`, { role: 'OPERATOR' }, adminToken);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: { id: other.id, email: other.email, role: 'OPERATOR', avatar: null } });
    assert.equal((await getMe(other.token)).status, 401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    assert.equal(stored.sessionVersion, 1);
  });

  it('never removes or demotes the last administrator', async () => {
    const other = await createAccount(fixtureEmail(), password, 'ADMIN');
    // Pretend the target is the only administrator, without touching real ones.
    const mock = overrideTransactions({ user: { count: async () => 1 } });
    try {
      for (const [method, body] of [['DELETE', undefined], ['PATCH', { role: 'DRIVER' }]] as const) {
        const response = await request(method, `/users/${other.id}`, body, adminToken);
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'The last administrator cannot be removed or demoted' });
      }
    } finally {
      mock.restore();
    }
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: other.id }, include: { role: true } });
    assert.equal(stored.role.name, 'ADMIN');
    assert.equal((await getMe(other.token)).status, 200);
  });

  it('retries serialization conflicts and reports when they persist', async () => {
    const retried = failTransactions(knownError('P2034'), driverConflict());
    try {
      const response = await request('GET', '/users', undefined, adminToken);
      assert.equal(response.status, 200);
      await response.json();
      assert.equal(retried.calls, 3);
    } finally {
      retried.restore();
    }
    const exhausted = failTransactions(driverConflict(), knownError('P2034'), knownError('P2034'), knownError('P2034'));
    try {
      const response = await post('/users', { email: fixtureEmail(), password }, adminToken);
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'Accounts changed during this request. Refresh and try again.' });
      assert.equal(exhausted.calls, 3);
    } finally {
      exhausted.restore();
    }
  });

  it('maps database errors to user errors and hides the rest', async () => {
    const account = await createAccount();
    for (const [error, status, message] of [
      [knownError('P2025'), 404, 'User not found'],
      [knownError('P2002'), 409, 'Email is already registered'],
      [knownError('P2003'), 500, 'Internal server error'],
      [new Error('connection lost'), 500, 'Internal server error'],
    ] as const) {
      const mock = failTransactions(error);
      try {
        const response = await request('PATCH', `/users/${account.id}`, { role: 'DRIVER' }, adminToken);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { error: message });
      } finally {
        mock.restore();
      }
    }
  });

  it('rechecks the actor inside every management transaction', async () => {
    const user = await fixtures.user('USER');
    const target = await fixtures.user('DRIVER');
    const stale = { id: administrator.id, sessionVersion: 1 };
    const ordinary = { id: user.id, sessionVersion: user.sessionVersion };
    for (const [actor, status] of [[stale, 401], [ordinary, 403]] as const) {
      for (const action of [
        () => listUsers(actor),
        () => createUser(actor, { email: fixtureEmail(), password, role: 'USER' }),
        () => updateUser(actor, target.id, { role: 'ADMIN' }),
        () => deleteUser(actor, target.id),
      ]) {
        await assert.rejects(action(), { status });
      }
    }
    const missingRole = overrideTransactions({ role: { findUnique: async () => null } });
    try {
      await assert.rejects(createUser({ id: administrator.id, sessionVersion: 0 }, { email: fixtureEmail(), password, role: 'USER' }), {
        status: 409, message: 'The requested role is missing. Check role configuration.',
      });
    } finally {
      missingRole.restore();
    }
  });

  it('bootstraps administrators only as the local command intends', async () => {
    const email = fixtureEmail();
    await assert.rejects(bootstrapAdministrator(email), { status: 400, message: 'A password is required for a new administrator' });
    const created = await bootstrapAdministrator(email, password);
    assert.deepEqual(created, { id: created.id, email, role: 'ADMIN', avatar: null });
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(await verify(stored.password, password), true);
    assert.deepEqual(await bootstrapAdministrator(email, 'another password!'), created);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { email } })).password, stored.password);

    const user = await fixtures.user('OPERATOR');
    await assert.rejects(bootstrapAdministrator(user.email), { status: 409, message: 'Promotion of the existing account must be confirmed' });
    const promoted = await bootstrapAdministrator(user.email, undefined, true);
    assert.equal(promoted.role, 'ADMIN');
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, user.sessionVersion + 1);
    assert.equal((await getMe(user.token)).status, 401);
  });

  it('refuses to bootstrap while the ADMIN role is unavailable', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const email = fixtureEmail();
    // Simulated: the shared role must never be changed by tests.
    for (const unavailable of [{ activ: false }, { endDate: new Date(Date.now() - 1000) }, { startDate: new Date(Date.now() + 60_000) }]) {
      const mock = overrideTransactions({ role: { findUnique: async () => ({ ...role, ...unavailable }) } });
      try {
        await assert.rejects(bootstrapAdministrator(email, password), {
          status: 409, message: 'The ADMIN role is inactive, not yet started, or expired. Check role configuration.',
        });
      } finally {
        mock.restore();
      }
    }
    assert.equal(await prisma.user.count({ where: { email } }), 0);
  });
});
