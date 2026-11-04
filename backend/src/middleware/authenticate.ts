import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import { isRoleValid } from '../lib/role.ts';
import { parseUserId } from '../lib/user-validation.ts';
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
  res.locals.role = user.role;
  res.locals.session = session;
  next();
}

export function requireAdmin(req: Request, res: Response<unknown, UserLocals>, next: NextFunction) {
  const role = res.locals.role;
  if (!role || role.name !== 'ADMIN' || !isRoleValid(role)) {
    throw new AppError(403, 'Administrator access is required');
  }
  next();
}

// For routes about the user in :id. Runs before any request body is parsed;
// services recheck access inside their transactions.
export function requireSelfOrAdmin(req: Request, res: Response<unknown, UserLocals>, next: NextFunction) {
  if (parseUserId(req.params.id) === res.locals.session?.id) return next();
  requireAdmin(req, res, next);
}
