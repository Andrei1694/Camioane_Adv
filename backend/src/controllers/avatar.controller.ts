import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseUserId } from '../lib/user-validation.ts';
import type { AvatarService } from '../services/avatar.service.ts';
import type { UserLocals } from '../types/user.ts';

type AvatarResponse = Response<unknown, UserLocals>;

function actor(res: AvatarResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createAvatarController(service: AvatarService) {
  return {
    async upload(req: Request, res: AvatarResponse) {
      if (!req.file?.storedFile) throw new AppError(400, 'Provide one file in the file field');
      res.json({ user: await service.set(actor(res), parseUserId(req.params.id), req.file.storedFile) });
    },

    async download(req: Request, res: AvatarResponse) {
      const avatar = await service.open(actor(res), parseUserId(req.params.id));
      if (res.destroyed) {
        avatar.body.destroy();
        return;
      }
      res.set({ 'Content-Type': avatar.mimeType, 'Content-Length': String(avatar.size) });
      // pipeline closes both streams on read failures and client disconnects.
      await pipeline(avatar.body, res);
    },

    async remove(req: Request, res: AvatarResponse) {
      await service.remove(actor(res), parseUserId(req.params.id));
      res.status(204).end();
    },
  };
}
