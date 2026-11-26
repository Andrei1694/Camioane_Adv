import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseBilling } from '../lib/billing-validation.ts';
import { parseUserId } from '../lib/user-validation.ts';
import { getBilling, removeBilling, saveBilling } from '../services/billing.service.ts';
import type { UserLocals } from '../types/user.ts';

type BillingResponse = Response<unknown, UserLocals>;

function actor(res: BillingResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export async function show(req: Request, res: BillingResponse) {
  res.json({ billing: await getBilling(actor(res), parseUserId(req.params.id)) });
}

export async function save(req: Request, res: BillingResponse) {
  res.json({ billing: await saveBilling(actor(res), parseUserId(req.params.id), parseBilling(req.body)) });
}

export async function remove(req: Request, res: BillingResponse) {
  await removeBilling(actor(res), parseUserId(req.params.id));
  res.status(204).end();
}
