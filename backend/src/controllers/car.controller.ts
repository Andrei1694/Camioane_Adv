import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseCarCreate, parseCarId, parseCarUpdate } from '../lib/car-validation.ts';
import type { CarService } from '../services/car.service.ts';
import type { UserLocals } from '../types/user.ts';

type CarResponse = Response<unknown, UserLocals>;

function actor(res: CarResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createCarController(service: CarService) {
  return {
    async list(req: Request, res: CarResponse) {
      res.json({ cars: await service.list(actor(res)) });
    },
    async get(req: Request, res: CarResponse) {
      res.json({ car: await service.get(actor(res), parseCarId(req.params.id)) });
    },
    async create(req: Request, res: CarResponse) {
      res.status(201).json({ car: await service.create(actor(res), parseCarCreate(req.body)) });
    },
    async update(req: Request, res: CarResponse) {
      res.json({ car: await service.update(actor(res), parseCarId(req.params.id), parseCarUpdate(req.body)) });
    },
    async remove(req: Request, res: CarResponse) {
      await service.remove(actor(res), parseCarId(req.params.id));
      res.status(204).end();
    },
  };
}
