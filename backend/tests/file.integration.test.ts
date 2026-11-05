import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { Readable } from 'node:stream';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { eventually, nextConnectionClosed, startServer } from './helpers/api.ts';
import type { TestServer } from './helpers/api.ts';
import { Fixtures, requireDatabase } from './helpers/fixtures.ts';
import type { FixtureUser } from './helpers/fixtures.ts';
import { audioOnlyMp4, boundary, corruptMp4, fileForm, image, multipart, multipartType, rawRequest, videoMp4 } from './helpers/media.ts';
import { driverConflict, failTransactions, knownError } from './helpers/prisma.ts';
import { tempStorage } from './helpers/storage.ts';
import type { TempStorage } from './helpers/storage.ts';
import { fileUploadTypes } from '../src/lib/file-validation.ts';
import { prisma } from '../src/lib/prisma.ts';
import { createFileService } from '../src/services/file.service.ts';

interface PublicFile {
  id: string;
  ownerId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}

const fixtures = new Fixtures();
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
let api: TestServer;
let small: TestServer;
let storage: TempStorage;
let owner: FixtureUser;
let admin: FixtureUser;

async function upload(token: string, data: Uint8Array, filename = 'upload.bin', server = api) {
  return server.request('POST', '/files', { token, body: fileForm(data, filename) });
}

async function uploaded(token: string, data: Uint8Array, filename?: string): Promise<PublicFile> {
  const response = await upload(token, data, filename);
  assert.equal(response.status, 201);
  const { file } = await response.json();
  fixtures.fileIds.add(file.id);
  return file;
}

async function errorOf(response: Response | { status: number; body: Buffer }) {
  if (response instanceof Response) return { status: response.status, body: await response.json() };
  return { status: response.status, body: JSON.parse(response.body.toString('utf8')) };
}

function rawUpload(body: Buffer, token: string, contentType = multipartType) {
  return rawRequest(`${api.baseUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'Content-Length': body.length },
    body,
  });
}

// Starts an upload whose connection the test controls.
function openUpload(body: Buffer, token: string, contentLength = body.length) {
  const client = httpRequest(`${api.baseUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': multipartType, 'Content-Length': contentLength },
  });
  client.on('error', () => {});
  client.write(body);
  return client;
}

function signal() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function assertNoUploads() {
  assert.deepEqual(await storage.keys(), []);
  assert.equal(await prisma.uploadedFile.count({ where: { ownerId: owner.id } }), 0);
}

describe('File API', { concurrency: false }, () => {
  before(async () => {
    await requireDatabase();
    storage = await tempStorage();
    api = await startServer({ fileStorage: storage.registry });
    small = await startServer({ fileStorage: storage.registry, uploadMaxFileSizeBytes: 1024 });
  });

  beforeEach(async () => {
    owner = await fixtures.user('DRIVER');
    admin = await fixtures.user('ADMIN');
  });

  afterEach(async () => {
    storage.storage.reset();
    await fixtures.cleanup();
    await storage.remove();
  });

  after(async () => {
    await api.close();
    await small.close();
    await prisma.$disconnect();
  });

  it('stores JPEG, PNG, WebP, and MP4 uploads with detected types', async () => {
    const samples = [
      [await image('jpeg'), 'photo.jpg', 'image/jpeg'],
      [await image('png'), 'graphic.png', 'image/png'],
      [await image('webp'), 'banner.webp', 'image/webp'],
      [videoMp4, 'clip.mp4', 'video/mp4'],
    ] as const;
    for (const [data, filename, mimeType] of samples) {
      const response = await upload(owner.token, data, filename);
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      const { file } = await response.json();
      fixtures.fileIds.add(file.id);
      assert.deepEqual(file, {
        id: file.id, ownerId: owner.id, originalName: filename, mimeType, size: data.length,
        createdAt: file.createdAt, downloadUrl: `/files/${file.id}/download`,
      });
      const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: file.id } });
      assert.equal(row.storageProvider, 'fake');
      assert.ok((await storage.keys()).includes(row.storageKey));
    }
    assert.equal((await storage.keys()).length, samples.length);
  });

  it('keeps a safe original name and never trusts the declared type', async () => {
    const file = await uploaded(owner.token, await image('png'), 'invoice‮gnp.exe');
    assert.equal(file.originalName, 'invoice_gnp.exe');
    assert.equal(file.mimeType, 'image/png');
  });

  it('lists files newest first, scoped to the owner unless an administrator asks', async () => {
    const other = await fixtures.user('USER');
    const mine = [];
    for (let index = 0; index < 3; index++) mine.push(await uploaded(owner.token, await image('png'), `file-${index}.png`));
    const theirs = await uploaded(other.token, await image('jpeg'), 'other.jpg');

    const listed = await api.request('GET', '/files', { token: owner.token });
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await listed.json(), { files: [...mine].reverse(), total: 3 });

    const page = await api.request('GET', '/files?limit=1&offset=1', { token: owner.token });
    assert.deepEqual(await page.json(), { files: [mine[1]], total: 3 });

    const everything = await api.request('GET', '/files?limit=100', { token: admin.token });
    const { files, total }: { files: PublicFile[]; total: number } = await everything.json();
    assert.ok(total >= 4);
    assert.deepEqual(files.filter((file) => fixtures.fileIds.has(file.id)), [theirs, ...[...mine].reverse()]);

    for (const [query, error] of [
      ['limit=0', 'Invalid pagination'],
      ['limit=101', 'Invalid pagination'],
      ['offset=-1', 'Invalid pagination'],
      ['page=2', 'Only limit and offset query parameters are supported'],
    ]) {
      assert.deepEqual(await errorOf(await api.request('GET', `/files?${query}`, { token: owner.token })), { status: 400, body: { error } });
    }
  });

  it('downloads exact bytes as an attachment for the owner and administrators only', async () => {
    const data = await image('webp');
    const file = await uploaded(owner.token, data, 'route map.webp');
    for (const token of [owner.token, admin.token]) {
      const response = await api.request('GET', file.downloadUrl, { token });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('content-length'), String(data.length));
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="route map.webp"');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), data);
    }
    const stranger = await fixtures.user('OPERATOR');
    for (const [path, token, status, error] of [
      [file.downloadUrl, stranger.token, 404, 'File not found'],
      [`/files/${randomUUID()}/download`, admin.token, 404, 'File not found'],
      ['/files/not-a-uuid/download', owner.token, 400, 'A valid file ID is required'],
    ] as const) {
      assert.deepEqual(await errorOf(await api.request('GET', path, { token })), { status, body: { error } });
    }
    assert.deepEqual(await errorOf(await api.request('GET', file.downloadUrl)), { status: 401, body: { error: 'Unauthorized' } });
  });

  it('deletes the object and the record for the owner or an administrator', async () => {
    const first = await uploaded(owner.token, await image('png'));
    const second = await uploaded(owner.token, await image('png'));
    const stranger = await fixtures.user('USER');
    for (const [id, token, status, error] of [
      [first.id, stranger.token, 404, 'File not found'],
      [randomUUID(), owner.token, 404, 'File not found'],
      ['bad', owner.token, 400, 'A valid file ID is required'],
    ] as const) {
      assert.deepEqual(await errorOf(await api.request('DELETE', `/files/${id}`, { token })), { status, body: { error } });
    }
    assert.equal((await storage.keys()).length, 2);
    for (const [file, token] of [[first, owner.token], [second, admin.token]] as const) {
      const response = await api.request('DELETE', `/files/${file.id}`, { token });
      assert.equal(response.status, 204);
      assert.equal(await response.text(), '');
    }
    await assertNoUploads();
  });

  it('keeps files when their owner is deleted, for administrators', async () => {
    const file = await uploaded(owner.token, await image('png'));
    await prisma.user.delete({ where: { id: owner.id } });
    const response = await api.request('GET', '/files?limit=100', { token: admin.token });
    const { files }: { files: PublicFile[] } = await response.json();
    assert.deepEqual(files.find((listed) => listed.id === file.id), { ...file, ownerId: null });
    const download = await api.request('GET', file.downloadUrl, { token: admin.token });
    assert.equal(download.status, 200);
    await download.arrayBuffer();
  });

  it('rejects unsupported, empty, and unreadable uploads without leaving objects', async () => {
    for (const [data, status, error] of [
      [Buffer.from('plain text'), 415, fileUploadTypes.message],
      [Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), 415, fileUploadTypes.message],
      [Buffer.alloc(0), 400, 'Empty files are not allowed'],
      [corruptMp4(), 422, 'The video could not be read. Upload a playable MP4 file.'],
      [audioOnlyMp4, 422, 'The MP4 file has no video stream.'],
    ] as const) {
      assert.deepEqual(await errorOf(await upload(owner.token, data, 'sample.mp4')), { status, body: { error } });
    }
    assert.deepEqual(await errorOf(await small.request('POST', '/files', { token: owner.token, body: fileForm(Buffer.concat([await image('png'), Buffer.alloc(2048)])) })),
      { status: 413, body: { error: 'File exceeds the upload size limit' } });
    assert.deepEqual(await errorOf(await api.request('POST', '/files', { token: owner.token, body: { file: 'json' } })),
      { status: 415, body: { error: 'Expected multipart/form-data' } });
    await assertNoUploads();
  });

  it('accepts exactly one file part named file', async () => {
    const png = await image('png');
    const oneFile = 'Upload exactly one file in the file field, without additional fields';
    for (const [parts, status, error] of [
      [[{ name: 'file', filename: 'a.png', data: png }, { name: 'note', data: 'extra' }], 400, oneFile],
      [[{ name: 'note', data: 'extra' }, { name: 'file', filename: 'a.png', data: png }], 400, oneFile],
      [[{ name: 'file', filename: 'a.png', data: png }, { name: 'file', filename: 'b.png', data: png }], 400, oneFile],
      [[{ name: 'upload', filename: 'a.png', data: png }], 400, oneFile],
      // A lone text field is dropped, which leaves no file.
      [[{ name: 'file', data: 'a text field named file' }], 400, 'Provide one file in the file field'],
      [[], 400, 'Provide one file in the file field'],
    ] as const) {
      assert.deepEqual(await errorOf(await rawUpload(multipart([...parts]), owner.token)), { status, body: { error } });
    }
    for (const [body, contentType] of [
      [multipart([{ name: 'file', filename: 'a.png', data: png }], { close: false }), multipartType],
      [multipart([{ name: 'file', filename: 'a.png', data: png }]), 'multipart/form-data'],
      [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"\r\nbroken header\r\n\r\n`), multipartType],
    ] as const) {
      assert.deepEqual(await errorOf(await rawUpload(body, owner.token, contentType)), { status: 400, body: { error: 'Malformed multipart upload' } });
    }
    await assertNoUploads();
  });

  it('removes the object when storage or later checks fail', async () => {
    storage.storage.beforePut = () => {
      throw new Error('storage unavailable');
    };
    assert.deepEqual(await errorOf(await upload(owner.token, await image('png'))), { status: 500, body: { error: 'Internal server error' } });
    storage.storage.beforePut = undefined;

    // Rejecting the extra part makes Multer remove the stored file; that fails too.
    storage.storage.beforeDelete = () => {
      throw new Error('storage unavailable');
    };
    const body = multipart([{ name: 'file', filename: 'a.png', data: await image('png') }, { name: 'note', data: 'extra' }]);
    assert.deepEqual(await errorOf(await rawUpload(body, owner.token)), { status: 500, body: { error: 'Internal server error' } });
    assert.equal(storage.storage.deleted.length, 1);
    assert.equal(await prisma.uploadedFile.count({ where: { ownerId: owner.id } }), 0);
  });

  it('reports stored objects that are missing or cannot be opened', async () => {
    const file = await uploaded(owner.token, await image('png'));
    const [key] = await storage.keys();
    storage.storage.beforeOpen = () => {
      throw new Error('disk failure');
    };
    assert.deepEqual(await errorOf(await api.request('GET', file.downloadUrl, { token: owner.token })),
      { status: 500, body: { error: 'Internal server error' } });
    storage.storage.beforeOpen = undefined;
    await storage.storage.inner.delete(key);
    assert.deepEqual(await errorOf(await api.request('GET', file.downloadUrl, { token: owner.token })),
      { status: 404, body: { error: 'File not found' } });
    // Deleting a record whose object is already gone still succeeds.
    assert.equal((await api.request('DELETE', `/files/${file.id}`, { token: owner.token })).status, 204);
    await assertNoUploads();
  });

  it('cleans up when the client disconnects during the upload', async () => {
    const png = await image('png');
    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\n`);

    // While the object is being written.
    const writing = signal();
    storage.storage.beforePut = writing.resolve;
    const midway = openUpload(Buffer.concat([header, png, Buffer.alloc(8192, 1)]), owner.token, 1024 * 1024);
    await writing.promise;
    midway.destroy();
    await eventually(() => storage.storage.writes.length === 1);
    assert.deepEqual(await Promise.all(storage.storage.writes), ['failed']);
    storage.storage.reset();

    // After the object is stored, before the request finishes.
    const closed = nextConnectionClosed(api.server);
    const stored = signal();
    storage.storage.afterPut = async () => {
      stored.resolve();
      await closed;
    };
    const complete = multipart([{ name: 'file', filename: 'a.png', data: png }]);
    const late = openUpload(complete, owner.token, complete.length + 100);
    await stored.promise;
    late.destroy();
    await eventually(() => storage.storage.deleted.length === 1);
    assert.deepEqual(await Promise.all(storage.storage.writes), ['stored']);
    await eventually(async () => (await storage.keys()).length === 0);
    storage.storage.reset();

    // After the whole body arrived, before the response.
    const gone = nextConnectionClosed(api.server);
    storage.storage.afterPut = () => gone;
    const whole = openUpload(complete, owner.token);
    await eventually(() => storage.storage.writes.length === 1);
    whole.destroy();
    await eventually(() => storage.storage.deleted.length === 1);
    await eventually(async () => (await storage.keys()).length === 0);
    await assertNoUploads();
  });

  it('closes the stored object when the client leaves before the download starts', async () => {
    const file = await uploaded(owner.token, await image('png'));
    const closed = nextConnectionClosed(api.server);
    const opening = signal();
    storage.storage.beforeOpen = async () => {
      opening.resolve();
      await closed;
    };
    const client = httpRequest(`${api.baseUrl}${file.downloadUrl}`, { headers: { Authorization: `Bearer ${owner.token}` } });
    client.on('error', () => {});
    client.end();
    await opening.promise;
    client.destroy();
    await eventually(() => storage.storage.opened.length === 1 && storage.storage.opened[0].destroyed);
  });

  it('retries serialization conflicts and reports when they persist', async () => {
    const retried = failTransactions(knownError('P2034'), driverConflict());
    try {
      const response = await api.request('GET', '/files', { token: owner.token });
      assert.equal(response.status, 200);
      await response.json();
      assert.equal(retried.calls, 3);
    } finally {
      retried.restore();
    }
    for (const errors of [[knownError('P2034'), driverConflict(), knownError('P2034')], [new Error('connection lost')]]) {
      const mock = failTransactions(...errors);
      try {
        const response = await upload(owner.token, await image('png'));
        const expected = errors.length === 3
          ? { status: 409, body: { error: 'Files changed during this request. Try again.' } }
          : { status: 500, body: { error: 'Internal server error' } };
        assert.deepEqual(await errorOf(response), expected);
      } finally {
        mock.restore();
      }
    }
    await assertNoUploads();
  });

  it('rechecks the session and cleans up after probe failures in the service', async (t) => {
    async function storedVideo() {
      const key = randomUUID();
      const { size } = await storage.storage.put({ key, body: Readable.from([videoMp4]), contentType: 'video/mp4' });
      return { provider: storage.storage.name, key, originalName: 'clip.mp4', mimeType: 'video/mp4', size };
    }
    const actor = { id: owner.id, sessionVersion: owner.sessionVersion };
    const files = createFileService(storage.registry, ffprobe);
    await assert.rejects(files.list({ ...actor, sessionVersion: actor.sessionVersion + 1 }, { limit: 1, offset: 0 }), { status: 401 });
    await assert.rejects(files.create({ ...actor, sessionVersion: actor.sessionVersion + 1 }, await storedVideo()), { status: 401 });

    const broken = createFileService(storage.registry, '/nonexistent/ffprobe');
    await assert.rejects(broken.create(actor, await storedVideo()), /could not be started/);
    assert.deepEqual(await storage.keys(), []);

    // A temporary directory that cannot be removed is reported, not fatal.
    const logged = t.mock.method(console, 'error', () => {});
    const realRm = fsPromises.rm;
    fsPromises.rm = async () => {
      throw new Error('directory busy');
    };
    syncBuiltinESMExports();
    try {
      const file = await files.create(actor, await storedVideo());
      fixtures.fileIds.add(file.id);
      assert.equal(file.mimeType, 'video/mp4');
    } finally {
      fsPromises.rm = realRm;
      syncBuiltinESMExports();
    }
    assert.equal(logged.mock.callCount(), 1);
    const [message] = logged.mock.calls[0].arguments;
    const directory = String(message).replace('Failed to remove temporary directory ', '');
    assert.match(directory, /camioane-probe-/);
    await realRm(directory, { recursive: true, force: true });
  });
});
