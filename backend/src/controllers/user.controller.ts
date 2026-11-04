import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseCreateUser, parseCredentials, parseUpdateUser, parseUserId } from '../lib/user-validation.ts';
import { createUser, deleteUser, listUsers, loginUser, updateUser } from '../services/user.service.ts';
import type { UserLocals } from '../types/user.ts';

type UserResponse = Response<unknown, UserLocals>;

function actor(res: UserResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export async function login(req: Request, res: Response) {
  res.json(await loginUser(parseCredentials(req.body)));
}

export function me(req: Request, res: UserResponse) {
  if (!res.locals.user) throw new AppError(401, 'Unauthorized');
  res.json({ user: res.locals.user });
}

export async function list(req: Request, res: UserResponse) {
  res.json({ users: await listUsers(actor(res)) });
}

export async function create(req: Request, res: UserResponse) {
  res.status(201).json({ user: await createUser(actor(res), parseCreateUser(req.body)) });
}

export async function update(req: Request, res: UserResponse) {
  res.json({ user: await updateUser(actor(res), parseUserId(req.params.id), parseUpdateUser(req.body)) });
}

export async function remove(req: Request, res: UserResponse) {
  await deleteUser(actor(res), parseUserId(req.params.id));
  res.status(204).end();
}
