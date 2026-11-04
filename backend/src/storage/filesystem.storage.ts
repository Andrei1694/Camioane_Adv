import { constants } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FileStorage } from './file-storage.ts';
import { StorageNotFoundError } from './file-storage.ts';

function isMissing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export class FilesystemStorage implements FileStorage {
  readonly name = 'filesystem';
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) {
      throw new Error('Invalid storage key');
    }
    return resolve(this.root, key);
  }

  async put(input: Parameters<FileStorage['put']>[0]) {
    const path = this.path(input.key);
    input.signal?.throwIfAborted();
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    // Never remove an existing object if exclusive creation fails.
    const handle = await open(path, 'wx', 0o600);
    try {
      const output = handle.createWriteStream();
      await pipeline(input.body, output, { signal: input.signal });
      return { key: input.key, size: output.bytesWritten };
    } catch (error) {
      await handle.close();
      await this.delete(input.key);
      throw error;
    }
  }

  async open(key: string) {
    try {
      // Open before returning, so missing files fail before HTTP headers are sent.
      const handle = await open(this.path(key), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      return handle.createReadStream();
    } catch (error) {
      if (isMissing(error)) throw new StorageNotFoundError();
      throw error;
    }
  }

  async delete(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}
