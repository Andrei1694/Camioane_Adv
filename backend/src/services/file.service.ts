import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Prisma } from '../generated/prisma/client.ts';
import type { UploadedFile } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { InvalidVideoError, probeVideo } from '../lib/ffmpeg.ts';
import { prisma } from '../lib/prisma.ts';
import { isRoleValid } from '../lib/role.ts';
import { StorageNotFoundError } from '../storage/file-storage.ts';
import type { FileStorage, FileStorageRegistry } from '../storage/file-storage.ts';
import type { FilePagination, StoredUpload } from '../types/file.ts';
import type { SessionIdentity } from '../types/user.ts';

function publicFile(file: UploadedFile) {
  return {
    id: file.id,
    ownerId: file.ownerId,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt,
    downloadUrl: `/files/${file.id}/download`,
  };
}

async function transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(action, { isolationLevel: 'Serializable' });
    } catch (error) {
      const conflict = (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        || (error instanceof Error && error.name === 'DriverAdapterError'
          && typeof error.cause === 'object' && error.cause !== null
          && 'kind' in error.cause && error.cause.kind === 'TransactionWriteConflict');
      if (!conflict) throw error;
      if (attempt === 2) throw new AppError(409, 'Files changed during this request. Try again.');
    }
  }
  throw new AppError(409, 'Files changed during this request. Try again.');
}

async function accessScope(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { id: true, sessionVersion: true, role: true },
  });
  if (!current || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  const admin = current.role.name === 'ADMIN' && isRoleValid(current.role);
  return admin ? {} : { ownerId: current.id };
}

async function accessibleFile(actor: SessionIdentity, id: string) {
  return transaction(async (tx) => {
    const scope = await accessScope(tx, actor);
    const file = await tx.uploadedFile.findFirst({ where: { id, ...scope } });
    if (!file) throw new AppError(404, 'File not found');
    return file;
  });
}

async function probeStoredVideo(provider: FileStorage, key: string, ffprobePath: string) {
  // ffprobe needs a seekable file because many MP4s keep their index at the end,
  // which a pipe cannot reach. Copying through the provider works for any storage.
  const directory = await mkdtemp(join(tmpdir(), 'camioane-probe-'));
  try {
    const path = join(directory, 'upload.mp4');
    await pipeline(await provider.open(key), createWriteStream(path, { flags: 'wx', mode: 0o600 }));
    return await probeVideo(ffprobePath, path);
  } catch (error) {
    if (error instanceof InvalidVideoError) throw new AppError(422, error.message);
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => {
      console.error(`Failed to remove temporary directory ${directory}`);
    });
  }
}

export function createFileService(storage: FileStorageRegistry, ffprobePath: string) {
  return {
    async create(actor: SessionIdentity, upload: StoredUpload) {
      const provider = storage.get(upload.provider);
      try {
        // Reject unreadable videos before saving metadata; the catch deletes the object.
        if (upload.mimeType === 'video/mp4') await probeStoredVideo(provider, upload.key, ffprobePath);
        const file = await transaction(async (tx) => {
          await accessScope(tx, actor);
          return tx.uploadedFile.create({
            data: {
              ownerId: actor.id,
              storageProvider: upload.provider,
              storageKey: upload.key,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              size: upload.size,
            },
          });
        });
        return publicFile(file);
      } catch (error) {
        await provider.delete(upload.key);
        throw error;
      }
    },

    async list(actor: SessionIdentity, pagination: FilePagination) {
      return transaction(async (tx) => {
        const where = await accessScope(tx, actor);
        const files = await tx.uploadedFile.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: pagination.limit,
          skip: pagination.offset,
        });
        const total = await tx.uploadedFile.count({ where });
        return { files: files.map(publicFile), total };
      });
    },

    async download(actor: SessionIdentity, id: string) {
      const file = await accessibleFile(actor, id);
      try {
        const body = await storage.get(file.storageProvider).open(file.storageKey);
        return { file: publicFile(file), body };
      } catch (error) {
        if (error instanceof StorageNotFoundError) throw new AppError(404, 'File not found');
        throw error;
      }
    },

    async remove(actor: SessionIdentity, id: string) {
      const file = await accessibleFile(actor, id);
      // External storage I/O stays outside transactions. A failed metadata delete
      // leaves a retryable record; provider deletion also accepts missing objects.
      await storage.get(file.storageProvider).delete(file.storageKey);
      await prisma.uploadedFile.deleteMany({ where: { id: file.id } });
    },
  };
}

export type FileService = ReturnType<typeof createFileService>;
