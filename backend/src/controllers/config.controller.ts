import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseConfigKey, parseConfigValue } from '../lib/config-validation.ts';
import { deleteConfig, getConfig, listConfig, setConfig } from '../services/config.service.ts';
import type { UserLocals } from '../types/user.ts';

type ConfigResponse = Response<unknown, UserLocals>;

function actor(res: ConfigResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export async function list(req: Request, res: ConfigResponse) {
  res.json({ entries: await listConfig(actor(res)) });
}

export async function get(req: Request, res: ConfigResponse) {
  res.json({ entry: await getConfig(actor(res), parseConfigKey(req.params.key)) });
}

export async function put(req: Request, res: ConfigResponse) {
  const key = parseConfigKey(req.params.key);
  const { entry, created } = await setConfig(actor(res), key, parseConfigValue(req.body));
  res.status(created ? 201 : 200).json({ entry });
}

export async function remove(req: Request, res: ConfigResponse) {
  await deleteConfig(actor(res), parseConfigKey(req.params.key));
  res.status(204).end();
}
