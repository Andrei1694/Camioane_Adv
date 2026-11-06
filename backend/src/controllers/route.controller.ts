import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseRouteCreate, parseRouteId, parseRoutePagination, parseRouteUpdate } from '../lib/route-validation.ts';
import type { RouteService } from '../services/route.service.ts';
import type { UserLocals } from '../types/user.ts';

type RouteResponse = Response<unknown, UserLocals>;

function actor(res: RouteResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createRouteController(service: RouteService) {
  return {
    async list(req: Request, res: RouteResponse) {
      res.json(await service.list(actor(res), parseRoutePagination(req.query)));
    },
    async get(req: Request, res: RouteResponse) {
      res.json({ route: await service.get(actor(res), parseRouteId(req.params.id)) });
    },
    async create(req: Request, res: RouteResponse) {
      res.status(201).json({ route: await service.create(actor(res), parseRouteCreate(req.body)) });
    },
    async update(req: Request, res: RouteResponse) {
      res.json({ route: await service.update(actor(res), parseRouteId(req.params.id), parseRouteUpdate(req.body)) });
    },
    async remove(req: Request, res: RouteResponse) {
      await service.remove(actor(res), parseRouteId(req.params.id));
      res.status(204).end();
    },
  };
}
