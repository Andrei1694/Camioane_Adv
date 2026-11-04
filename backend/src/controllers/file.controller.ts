import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseFileId, parseFilePagination } from '../lib/file-validation.ts';
import type { FileService } from '../services/file.service.ts';
import type { UserLocals } from '../types/user.ts';

type FileResponse = Response<unknown, UserLocals>;

function actor(res: FileResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createFileController(service: FileService) {
  return {
    async create(req: Request, res: FileResponse) {
      if (!req.file?.storedFile) throw new AppError(400, 'Provide one file in the file field');
      const file = await service.create(actor(res), req.file.storedFile);
      res.status(201).json({ file });
    },

    async list(req: Request, res: FileResponse) {
      res.json(await service.list(actor(res), parseFilePagination(req.query)));
    },

    async download(req: Request, res: FileResponse) {
      const { file, body } = await service.download(actor(res), parseFileId(req.params.id));
      if (res.destroyed) {
        body.destroy();
        return;
      }
      res.attachment(file.originalName);
      res.set({ 'Content-Type': file.mimeType, 'Content-Length': String(file.size) });
      // pipeline closes both streams on read failures and client disconnects.
      await pipeline(body, res);
    },

    async remove(req: Request, res: FileResponse) {
      await service.remove(actor(res), parseFileId(req.params.id));
      res.status(204).end();
    },
  };
}
