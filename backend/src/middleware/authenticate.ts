import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import { findSessionUser, publicUser } from '../services/user.service.ts';
import type { UserLocals } from '../types/user.ts';

export async function authenticate(req: Request, res: Response<unknown, UserLocals>, next: NextFunction) {
  const match = /^Bearer +([^\s]+)$/i.exec(req.get('Authorization') ?? '');

  if (!match) {
    throw new AppError(401, 'Unauthorized');
  }

  const session = await verifyAccessToken(match[1]);
  const user = await findSessionUser(session.id);

  if (!user || user.sessionVersion !== session.sessionVersion) {
    throw new AppError(401, 'Unauthorized');
  }

  res.locals.user = publicUser(user);
  res.locals.session = session;
  next();
}

export function requireAdmin(req: Request, res: Response<unknown, UserLocals>, next: NextFunction) {
  if (res.locals.user?.role !== 'ADMIN') throw new AppError(403, 'Administrator access is required');
  next();
}
