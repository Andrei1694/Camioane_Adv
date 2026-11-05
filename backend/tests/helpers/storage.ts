import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { FileStorageRegistry } from '../../src/storage/file-storage.ts';
import type { FileStorage } from '../../src/storage/file-storage.ts';
import { FilesystemStorage } from '../../src/storage/filesystem.storage.ts';

type Hook = () => Promise<void> | void;

// Filesystem storage in a temporary directory, with hooks that let tests fail
// or delay each operation.
export class FakeStorage implements FileStorage {
  readonly name = 'fake';
  readonly inner: FilesystemStorage;
  readonly deleted: string[] = [];
  readonly opened: Readable[] = [];
  /** How each write ended, in order. */
  readonly writes: Promise<'stored' | 'failed'>[] = [];
  beforePut?: Hook;
  afterPut?: Hook;
  beforeOpen?: Hook;
  beforeDelete?: Hook;

  constructor(root: string) {
    this.inner = new FilesystemStorage(root);
  }

  async put(input: Parameters<FileStorage['put']>[0]) {
    await this.beforePut?.();
    const writing = this.inner.put(input);
    this.writes.push(writing.then(() => 'stored', () => 'failed'));
    const result = await writing;
    await this.afterPut?.();
    return result;
  }

  async open(key: string): Promise<Readable> {
    await this.beforeOpen?.();
    const body = await this.inner.open(key);
    this.opened.push(body);
    return body;
  }

  async delete(key: string) {
    this.deleted.push(key);
    await this.beforeDelete?.();
    await this.inner.delete(key);
  }

  reset() {
    this.beforePut = this.afterPut = this.beforeOpen = this.beforeDelete = undefined;
    this.deleted.length = 0;
    this.opened.length = 0;
    this.writes.length = 0;
  }
}

export async function tempStorage() {
  const root = await mkdtemp(join(tmpdir(), 'camioane-test-storage-'));
  const storage = new FakeStorage(root);
  return {
    root,
    storage,
    registry: new FileStorageRegistry([storage], storage.name),
    /** Keys of every stored object, to check that nothing is orphaned. */
    async keys() {
      return (await readdir(root).catch(() => [])).sort();
    },
    /** Deletes every object; the next write recreates the directory. */
    remove: () => rm(root, { recursive: true, force: true }),
  };
}

export type TempStorage = Awaited<ReturnType<typeof tempStorage>>;
