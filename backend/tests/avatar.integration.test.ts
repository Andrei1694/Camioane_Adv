import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import sharp from 'sharp';
import { eventually, nextConnectionClosed, startServer } from './helpers/api.ts';
import type { TestServer } from './helpers/api.ts';
import { Fixtures, requireDatabase } from './helpers/fixtures.ts';
import type { FixtureUser } from './helpers/fixtures.ts';
import { corruptMp4, fileForm, image, videoMp4 } from './helpers/media.ts';
import { driverConflict, failTransactions, knownError } from './helpers/prisma.ts';
import { tempStorage } from './helpers/storage.ts';
import type { TempStorage } from './helpers/storage.ts';
import { imageUploadTypes } from '../src/lib/file-validation.ts';
import { prisma } from '../src/lib/prisma.ts';
import { createAvatarService } from '../src/services/avatar.service.ts';

const fixtures = new Fixtures();
let api: TestServer;
let storage: TempStorage;
let user: FixtureUser;
let admin: FixtureUser;

async function upload(target: FixtureUser | string, token: string, data: Uint8Array, filename = 'photo.png') {
  const id = typeof target === 'string' ? target : target.id;
  return api.request('PUT', `/users/${id}/avatar`, { token, body: fileForm(data, filename) });
}

async function errorOf(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function storedUpload() {
  const key = randomUUID();
  const { size } = await storage.storage.put({ key, body: Readable.from([await image('webp')]), contentType: 'image/webp' });
  return { provider: storage.storage.name, key, originalName: 'photo.webp', mimeType: 'image/webp', size };
}

describe('Profile picture API', { concurrency: false }, () => {
  before(async () => {
    await requireDatabase();
    storage = await tempStorage();
    api = await startServer({ fileStorage: storage.registry });
  });

  beforeEach(async () => {
    user = await fixtures.user('USER');
    admin = await fixtures.user('ADMIN');
  });

  afterEach(async () => {
    storage.storage.reset();
    await fixtures.cleanup();
    await storage.remove();
  });

  after(async () => {
    await api.close();
    await prisma.$disconnect();
  });

  it('lets users set, read, and remove their own picture', async () => {
    const response = await upload(user, user.token, await image('png', 900, 400));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const { user: updated } = await response.json();
    assert.equal(updated.avatar.url, `/users/${user.id}/avatar`);
    assert.ok(!Number.isNaN(Date.parse(updated.avatar.updatedAt)));
    assert.deepEqual(updated, { id: user.id, email: user.email, role: 'USER', avatar: updated.avatar });
    assert.deepEqual(await (await api.request('GET', '/users/me', { token: user.token })).json(), { user: updated });

    const [key] = await storage.keys();
    const row = await prisma.userAvatar.findUniqueOrThrow({ where: { userId: user.id } });
    assert.deepEqual({ key: row.storageKey, provider: row.storageProvider, mimeType: row.mimeType }, { key, provider: 'fake', mimeType: 'image/webp' });

    const download = await api.request('GET', `/users/${user.id}/avatar`, { token: user.token });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'image/webp');
    assert.equal(download.headers.get('content-length'), String(row.size));
    assert.equal(download.headers.get('cache-control'), 'no-store');
    const picture = Buffer.from(await download.arrayBuffer());
    assert.equal(picture.length, row.size);
    const metadata = await sharp(picture).metadata();
    assert.deepEqual([metadata.format, metadata.width, metadata.height], ['webp', 512, 512]);

    const removed = await api.request('DELETE', `/users/${user.id}/avatar`, { token: user.token });
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), '');
    assert.deepEqual(await storage.keys(), []);
    assert.equal(await prisma.userAvatar.count({ where: { userId: user.id } }), 0);
    assert.deepEqual(await errorOf(await api.request('GET', `/users/${user.id}/avatar`, { token: user.token })),
      { status: 404, body: { error: 'Profile picture not found' } });
    assert.equal((await api.request('DELETE', `/users/${user.id}/avatar`, { token: user.token })).status, 204);
  });

  it('deletes the previous object when a picture is replaced', async () => {
    assert.equal((await upload(user, user.token, await image('png'))).status, 200);
    const [first] = await storage.keys();
    assert.equal((await upload(user, user.token, await image('jpeg'), 'photo.jpg')).status, 200);
    const keys = await storage.keys();
    assert.equal(keys.length, 1);
    assert.notEqual(keys[0], first);
    assert.deepEqual(storage.storage.deleted, [first]);
    assert.equal((await prisma.userAvatar.findUniqueOrThrow({ where: { userId: user.id } })).storageKey, keys[0]);
  });

  it('lets administrators manage anyone\'s picture', async () => {
    assert.equal((await upload(user, admin.token, await image('webp'))).status, 200);
    const download = await api.request('GET', `/users/${user.id}/avatar`, { token: admin.token });
    assert.equal(download.status, 200);
    await download.arrayBuffer();
    assert.equal((await api.request('DELETE', `/users/${user.id}/avatar`, { token: admin.token })).status, 204);
    assert.deepEqual(await storage.keys(), []);
  });

  it('refuses other users before reading the upload', async () => {
    const driver = await fixtures.user('DRIVER');
    assert.equal((await upload(user, user.token, await image('png'))).status, 200);
    const keys = await storage.keys();
    for (const [method, body] of [['PUT', fileForm(await image('png'))], ['GET', undefined], ['DELETE', undefined]] as const) {
      const response = await api.request(method, `/users/${user.id}/avatar`, { token: driver.token, ...(body ? { body } : {}) });
      assert.deepEqual(await errorOf(response), { status: 403, body: { error: 'Administrator access is required' } });
      const anonymous = await api.request(method, `/users/${user.id}/avatar`);
      assert.deepEqual(await errorOf(anonymous), { status: 401, body: { error: 'Unauthorized' } });
    }
    assert.deepEqual(await storage.keys(), keys);
    assert.deepEqual(storage.storage.deleted, []);
  });

  it('validates the user ID and reports missing users', async () => {
    for (const method of ['PUT', 'GET', 'DELETE']) {
      const response = await api.request(method, '/users/not-a-uuid/avatar', { token: admin.token });
      assert.deepEqual(await errorOf(response), { status: 400, body: { error: 'A valid user ID is required' } });
    }
    const missing = randomUUID();
    const response = await upload(missing, admin.token, await image('png'));
    assert.deepEqual(await errorOf(response), { status: 404, body: { error: 'User not found' } });
    assert.equal(storage.storage.deleted.length, 1);
    assert.deepEqual(await storage.keys(), []);
    for (const method of ['GET', 'DELETE']) {
      const result = await api.request(method, `/users/${missing}/avatar`, { token: admin.token });
      assert.deepEqual(await errorOf(result), { status: 404, body: { error: 'User not found' } });
    }
  });

  it('accepts only readable JPEG, PNG, and WebP images within 10 MiB', async () => {
    const png = await image('png');
    for (const [data, status, error] of [
      [videoMp4, 415, imageUploadTypes.message],
      [corruptMp4(), 415, imageUploadTypes.message],
      [Buffer.from('not an image at all'), 415, imageUploadTypes.message],
      [Buffer.concat([png.subarray(0, 64), Buffer.alloc(512, 1)]), 422, 'The image could not be read'],
      [Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]), 413, 'File exceeds the upload size limit'],
    ] as const) {
      assert.deepEqual(await errorOf(await upload(user, user.token, data)), { status, body: { error } });
    }
    const plain = await api.request('PUT', `/users/${user.id}/avatar`, { token: user.token, body: png, headers: { 'Content-Type': 'image/png' } });
    assert.deepEqual(await errorOf(plain), { status: 415, body: { error: 'Expected multipart/form-data' } });
    assert.deepEqual(await storage.keys(), []);
    assert.equal(await prisma.userAvatar.count({ where: { userId: user.id } }), 0);
  });

  it('reports a stored picture that is missing or cannot be opened', async () => {
    assert.equal((await upload(user, user.token, await image('png'))).status, 200);
    const [key] = await storage.keys();
    storage.storage.beforeOpen = () => {
      throw new Error('disk failure');
    };
    assert.deepEqual(await errorOf(await api.request('GET', `/users/${user.id}/avatar`, { token: user.token })),
      { status: 500, body: { error: 'Internal server error' } });
    storage.storage.beforeOpen = undefined;
    // A concurrent replacement can delete the object after the row was read.
    await storage.storage.inner.delete(key);
    assert.deepEqual(await errorOf(await api.request('GET', `/users/${user.id}/avatar`, { token: user.token })),
      { status: 404, body: { error: 'Profile picture not found' } });
  });

  it('closes the stored picture when the client leaves before the download starts', async () => {
    assert.equal((await upload(user, user.token, await image('png'))).status, 200);
    const closed = nextConnectionClosed(api.server);
    let opening: () => void = () => {};
    const opened = new Promise<void>((resolve) => {
      opening = resolve;
    });
    storage.storage.beforeOpen = async () => {
      opening();
      await closed;
    };
    const client = httpRequest(`${api.baseUrl}/users/${user.id}/avatar`, { headers: { Authorization: `Bearer ${user.token}` } });
    client.on('error', () => {});
    client.end();
    await opened;
    client.destroy();
    await eventually(() => storage.storage.opened.length === 1 && storage.storage.opened[0].destroyed);
    assert.equal(storage.storage.opened.length, 1);
  });

  it('rechecks access, deletes rejected uploads, and retries conflicts in the service', async () => {
    const avatars = createAvatarService(storage.registry);
    const self = { id: user.id, sessionVersion: user.sessionVersion };
    const other = await fixtures.user('OPERATOR');
    const rejected = await storedUpload();
    await assert.rejects(avatars.set(self, other.id, rejected), { status: 403, message: 'Administrator access is required' });
    await assert.rejects(avatars.open(self, other.id), { status: 403 });
    await assert.rejects(avatars.remove(self, other.id), { status: 403 });
    const stale = { id: user.id, sessionVersion: user.sessionVersion + 1 };
    const staleUpload = await storedUpload();
    await assert.rejects(avatars.set(stale, user.id, staleUpload), { status: 401, message: 'Unauthorized' });
    await assert.rejects(avatars.open(stale, user.id), { status: 401 });
    assert.deepEqual(await storage.keys(), []);

    const retried = failTransactions(knownError('P2034'), driverConflict());
    try {
      const updated = await avatars.set(self, user.id, await storedUpload());
      assert.equal(updated.avatar?.url, `/users/${user.id}/avatar`);
      assert.equal(retried.calls, 3);
    } finally {
      retried.restore();
    }
    const exhausted = failTransactions(knownError('P2034'), knownError('P2034'), knownError('P2034'));
    try {
      const conflicted = await storedUpload();
      await assert.rejects(avatars.set(self, user.id, conflicted), {
        status: 409, message: 'The profile picture changed during this request. Try again.',
      });
      assert.equal((await storage.keys()).includes(conflicted.key), false);
    } finally {
      exhausted.restore();
    }
    // discard ignores a missing location.
    await avatars.discard(null);
  });
});
