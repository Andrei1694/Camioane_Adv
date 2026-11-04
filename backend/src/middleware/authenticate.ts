import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import { findUserByEmail } from '../services/user.service.ts';
import type { UserLocals } from '../types/user.ts';

export async function authenticate(req: Request, res: Response<unknown, UserLocals>, next: NextFunction) {
  const match = /^Bearer +([^\s]+)$/i.exec(req.get('Authorization') ?? '');

  if (!match) {
    throw new AppError(401, 'Unauthorized');
  }

  const email = await verifyAccessToken(match[1]);
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError(401, 'Unauthorized');
  }

  res.locals.user = user;
  next();
}
