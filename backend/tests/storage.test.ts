import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { after, before, describe, it } from 'node:test';
import { FileStorageRegistry, StorageNotFoundError } from '../src/storage/file-storage.ts';
import type { FileStorage } from '../src/storage/file-storage.ts';
import { FilesystemStorage } from '../src/storage/filesystem.storage.ts';

let parent: string;

function named(name: string): FileStorage {
  const storage = new FilesystemStorage(join(parent, 'named'));
  return { name, put: storage.put.bind(storage), open: storage.open.bind(storage), delete: storage.delete.bind(storage) };
}

before(async () => {
  parent = await mkdtemp(join(tmpdir(), 'camioane-storage-test-'));
});

after(async () => {
  await rm(parent, { recursive: true, force: true });
});

describe('Filesystem storage', () => {
  it('creates its private root on first write and reports the bytes written', async () => {
    const root = join(parent, 'nested', 'root');
    const storage = new FilesystemStorage(root);
    assert.equal(storage.name, 'filesystem');
    const key = randomUUID();
    assert.deepEqual(await storage.put({ key, body: Readable.from(['hello ', 'world']), contentType: 'text/plain' }), { key, size: 11 });
    assert.equal(await readFile(join(root, key), 'utf8'), 'hello world');
    assert.equal(await text(await storage.open(key)), 'hello world');
  });

  it('never overwrites an existing object', async () => {
    const storage = new FilesystemStorage(parent);
    const key = randomUUID();
    await storage.put({ key, body: Readable.from(['original']), contentType: 'text/plain' });
    await assert.rejects(storage.put({ key, body: Readable.from(['replacement']), contentType: 'text/plain' }), { code: 'EEXIST' });
    assert.equal(await readFile(join(parent, key), 'utf8'), 'original');
  });

  it('refuses a cancelled write before touching the disk', async () => {
    const root = join(parent, 'never-created');
    const storage = new FilesystemStorage(root);
    await assert.rejects(storage.put({
      key: randomUUID(), body: Readable.from(['x']), contentType: 'text/plain', signal: AbortSignal.abort(new Error('stopped')),
    }), /stopped/);
    await assert.rejects(readdir(root), { code: 'ENOENT' });
  });

  it('removes a partial object when the body fails or the write is cancelled', async () => {
    const root = join(parent, 'partial');
    const storage = new FilesystemStorage(root);
    const failing = Readable.from((async function* () {
      yield Buffer.from('partial data');
      throw new Error('client went away');
    })());
    await assert.rejects(storage.put({ key: randomUUID(), body: failing, contentType: 'text/plain' }), /client went away/);
    const controller = new AbortController();
    const slow = new Readable({ read() {} });
    slow.push('first chunk');
    const write = storage.put({ key: randomUUID(), body: slow, contentType: 'text/plain', signal: controller.signal });
    setImmediate(() => controller.abort(new Error('cancelled')));
    await assert.rejects(write, { name: 'AbortError' });
    assert.deepEqual(await readdir(root), []);
  });

  it('accepts only lowercase UUID keys', async () => {
    const storage = new FilesystemStorage(parent);
    for (const key of ['../escape', randomUUID().toUpperCase(), '', 'a/b']) {
      await assert.rejects(storage.put({ key, body: Readable.from(['x']), contentType: 'text/plain' }), /Invalid storage key/);
      await assert.rejects(storage.open(key), /Invalid storage key/);
      await assert.rejects(storage.delete(key), /Invalid storage key/);
    }
  });

  it('reports missing objects and treats deleting them as success', async () => {
    const storage = new FilesystemStorage(parent);
    const key = randomUUID();
    await assert.rejects(storage.open(key), StorageNotFoundError);
    await storage.delete(key);
    await writeFile(join(parent, key), 'data');
    await storage.delete(key);
    await storage.delete(key);
    await assert.rejects(storage.open(key), (error: unknown) => {
      assert.ok(error instanceof StorageNotFoundError);
      assert.equal(error.name, 'StorageNotFoundError');
      assert.equal(error.message, 'Stored file not found');
      return true;
    });
  });

  it('passes on errors other than a missing object', async () => {
    const storage = new FilesystemStorage(parent);
    const key = randomUUID();
    await mkdir(join(parent, key));
    await assert.rejects(storage.delete(key), (error: unknown) => error instanceof Error && !(error instanceof StorageNotFoundError));
  });
});

describe('Storage registry', () => {
  it('looks up providers by name and picks the upload provider', () => {
    const first = named('first');
    const second = named('second');
    const registry = new FileStorageRegistry([first, second], 'second');
    assert.equal(registry.uploadStorage, second);
    assert.equal(registry.get('first'), first);
    assert.throws(() => registry.get('third'), /File storage provider is not configured: third/);
  });

  it('requires unique, nonblank names and a configured upload provider', () => {
    assert.throws(() => new FileStorageRegistry([named(' ')], ' '), /unique, nonblank names/);
    assert.throws(() => new FileStorageRegistry([named('a'), named('a')], 'a'), /unique, nonblank names/);
    assert.throws(() => new FileStorageRegistry([named('a')], 'b'), /not configured: b/);
  });
});
