import type { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { prisma } from '../lib/prisma.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import { StorageNotFoundError } from '../storage/file-storage.ts';
import type { FileStorageRegistry } from '../storage/file-storage.ts';
import type { StorageLocation, StoredUpload } from '../types/file.ts';
import type { SessionIdentity } from '../types/user.ts';
import { publicSelect, publicUser } from './user.service.ts';

const conflictMessage = 'The profile picture changed during this request. Try again.';
const locationSelect = { storageProvider: true, storageKey: true } as const;

// Users manage their own picture; a currently valid ADMIN manages anyone's.
// Rechecked inside each transaction, after the route-level check.
async function authorize(tx: Prisma.TransactionClient, actor: SessionIdentity, userId: string) {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { sessionVersion: true, role: true },
  });
  if (!current || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (userId !== actor.id && (current.role.name !== 'ADMIN' || !isRoleValid(current.role))) {
    throw new AppError(403, 'Administrator access is required');
  }
  const target = await tx.user.findUnique({ where: { id: userId }, select: { avatar: { select: locationSelect } } });
  if (!target) throw new AppError(404, 'User not found');
  return target.avatar;
}

export function createAvatarService(storage: FileStorageRegistry) {
  // Best effort, for objects whose metadata is already gone. A failure leaves an
  // orphaned object, never a broken picture, so the request still succeeds.
  async function discard(location: StorageLocation | null) {
    if (!location) return;
    try {
      await storage.get(location.provider).delete(location.key);
    } catch {
      console.error('Failed to delete a stored profile picture');
    }
  }

  return {
    discard,

    async set(actor: SessionIdentity, userId: string, upload: StoredUpload) {
      let result;
      try {
        result = await serializable(async (tx) => {
          const previous = await authorize(tx, actor, userId);
          const location = { storageProvider: upload.provider, storageKey: upload.key, mimeType: upload.mimeType, size: upload.size };
          const user = await tx.user.update({
            where: { id: userId },
            data: { avatar: { upsert: { create: location, update: location } } },
            select: publicSelect,
          });
          return { user: publicUser(user), previous };
        }, conflictMessage);
      } catch (error) {
        await storage.get(upload.provider).delete(upload.key);
        throw error;
      }
      // Delete the replaced object only once nothing references it.
      if (result.previous) await discard({ provider: result.previous.storageProvider, key: result.previous.storageKey });
      return result.user;
    },

    async open(actor: SessionIdentity, userId: string) {
      const avatar = await serializable(async (tx) => {
        await authorize(tx, actor, userId);
        return tx.userAvatar.findUnique({ where: { userId } });
      }, conflictMessage);
      if (!avatar) throw new AppError(404, 'Profile picture not found');
      try {
        const body = await storage.get(avatar.storageProvider).open(avatar.storageKey);
        return { mimeType: avatar.mimeType, size: avatar.size, body };
      } catch (error) {
        // A concurrent replacement can delete the object after the read above.
        if (error instanceof StorageNotFoundError) throw new AppError(404, 'Profile picture not found');
        throw error;
      }
    },

    async remove(actor: SessionIdentity, userId: string) {
      const avatar = await serializable((tx) => authorize(tx, actor, userId), conflictMessage);
      if (!avatar) return;
      // Object first, as for files: a failed metadata delete leaves a retryable
      // row. Matching the key keeps a concurrent replacement.
      await storage.get(avatar.storageProvider).delete(avatar.storageKey);
      await prisma.userAvatar.deleteMany({
        where: { userId, storageProvider: avatar.storageProvider, storageKey: avatar.storageKey },
      });
    },
  };
}

export type AvatarService = ReturnType<typeof createAvatarService>;
