import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseConfigVariableCreate, parseConfigVariableId, parseConfigVariableUpdate } from '../lib/config-variable-validation.ts';
import type { ConfigVariableService } from '../services/config-variable.service.ts';
import type { UserLocals } from '../types/user.ts';

type ConfigVariableResponse = Response<unknown, UserLocals>;

function actor(res: ConfigVariableResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createConfigVariableController(service: ConfigVariableService) {
  return {
    async list(_req: Request, res: ConfigVariableResponse) {
      res.json({ configVariables: await service.list(actor(res)) });
    },
    async get(req: Request, res: ConfigVariableResponse) {
      res.json({ configVariable: await service.get(actor(res), parseConfigVariableId(req.params.id)) });
    },
    async create(req: Request, res: ConfigVariableResponse) {
      res.status(201).json({ configVariable: await service.create(actor(res), parseConfigVariableCreate(req.body)) });
    },
    async update(req: Request, res: ConfigVariableResponse) {
      res.json({ configVariable: await service.update(actor(res), parseConfigVariableId(req.params.id), parseConfigVariableUpdate(req.body)) });
    },
    async remove(req: Request, res: ConfigVariableResponse) {
      await service.remove(actor(res), parseConfigVariableId(req.params.id));
      res.status(204).end();
    },
  };
}
