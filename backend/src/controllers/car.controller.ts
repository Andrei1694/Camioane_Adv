import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseCarId, parseCarQuery, parseCreateCar, parseUpdateCar } from '../lib/car-validation.ts';
import { createCar, deleteCar, getCar, listCars, updateCar } from '../services/car.service.ts';
import type { UserLocals } from '../types/user.ts';

type CarResponse = Response<unknown, UserLocals>;

function actor(res: CarResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export async function list(req: Request, res: CarResponse) {
  res.json(await listCars(actor(res), parseCarQuery(req.query)));
}

export async function get(req: Request, res: CarResponse) {
  res.json({ car: await getCar(actor(res), parseCarId(req.params.id)) });
}

export async function create(req: Request, res: CarResponse) {
  res.status(201).json({ car: await createCar(actor(res), parseCreateCar(req.body)) });
}

export async function update(req: Request, res: CarResponse) {
  res.json({ car: await updateCar(actor(res), parseCarId(req.params.id), parseUpdateCar(req.body)) });
}

export async function remove(req: Request, res: CarResponse) {
  await deleteCar(actor(res), parseCarId(req.params.id));
  res.status(204).end();
}
