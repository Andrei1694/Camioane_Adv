import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStorageRegistry } from '../storage/file-storage.ts';
import { FilesystemStorage } from '../storage/filesystem.storage.ts';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));

export function validateUploadSize(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    throw new Error('UPLOAD_MAX_FILE_SIZE_BYTES must be an integer between 1 and 2147483647.');
  }
  return value;
}

export function loadFileConfig(env: NodeJS.ProcessEnv = process.env) {
  const driver = env.FILE_STORAGE_DRIVER ?? 'filesystem';
  const root = env.FILE_STORAGE_ROOT ?? './uploads';
  if (!driver.trim()) throw new Error('FILE_STORAGE_DRIVER must not be blank.');
  if (!root.trim() || root.includes('\0')) throw new Error('FILE_STORAGE_ROOT must be a valid directory path.');
  const rawSize = env.UPLOAD_MAX_FILE_SIZE_BYTES ?? '104857600';
  if (!/^\d+$/.test(rawSize)) throw new Error('UPLOAD_MAX_FILE_SIZE_BYTES must be a positive integer.');
  return { driver, root: resolve(backendRoot, root), maxFileSize: validateUploadSize(Number(rawSize)) };
}

export function createFileStorage(config: ReturnType<typeof loadFileConfig>) {
  return new FileStorageRegistry([new FilesystemStorage(config.root)], config.driver);
}
