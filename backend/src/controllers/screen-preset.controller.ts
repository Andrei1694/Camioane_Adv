import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseScreenPresetCreate, parseScreenPresetId, parseScreenPresetUpdate } from '../lib/screen-preset-validation.ts';
import type { ScreenPresetService } from '../services/screen-preset.service.ts';
import type { UserLocals } from '../types/user.ts';

type ScreenPresetResponse = Response<unknown, UserLocals>;

function actor(res: ScreenPresetResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createScreenPresetController(service: ScreenPresetService) {
  return {
    async list(_req: Request, res: ScreenPresetResponse) {
      res.json({ presets: await service.list(actor(res)) });
    },
    async get(req: Request, res: ScreenPresetResponse) {
      res.json({ preset: await service.get(actor(res), parseScreenPresetId(req.params.id)) });
    },
    async create(req: Request, res: ScreenPresetResponse) {
      res.status(201).json({ preset: await service.create(actor(res), parseScreenPresetCreate(req.body)) });
    },
    async update(req: Request, res: ScreenPresetResponse) {
      res.json({ preset: await service.update(actor(res), parseScreenPresetId(req.params.id), parseScreenPresetUpdate(req.body)) });
    },
    async remove(req: Request, res: ScreenPresetResponse) {
      await service.remove(actor(res), parseScreenPresetId(req.params.id));
      res.status(204).end();
    },
  };
}
