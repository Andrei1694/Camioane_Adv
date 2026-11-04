import type { Readable } from 'node:stream';

export interface FileStorage {
  readonly name: string;
  put(input: {
    key: string;
    body: Readable;
    contentType: string;
    signal?: AbortSignal;
  }): Promise<{ key: string; size: number }>;
  open(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

export class StorageNotFoundError extends Error {
  constructor() {
    super('Stored file not found');
    this.name = 'StorageNotFoundError';
  }
}

export class FileStorageRegistry {
  readonly uploadStorage: FileStorage;
  private readonly providers = new Map<string, FileStorage>();

  constructor(providers: readonly FileStorage[], uploadProvider: string) {
    for (const provider of providers) {
      if (!provider.name.trim() || this.providers.has(provider.name)) {
        throw new Error('Storage providers must have unique, nonblank names.');
      }
      this.providers.set(provider.name, provider);
    }
    this.uploadStorage = this.get(uploadProvider);
  }

  get(name: string): FileStorage {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`File storage provider is not configured: ${name}`);
    return provider;
  }
}
