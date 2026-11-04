import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { loginUser, registerUser } from '../services/user.service.ts';
import type { AuthenticationData, PublicUser, UserCredentials, UserLocals } from '../types/user.ts';

function parseCredentials(body: unknown): UserCredentials {
  if (typeof body !== 'object' || body === null || Array.isArray(body)
    || !('email' in body) || !('password' in body)
    || typeof body.email !== 'string' || typeof body.password !== 'string') {
    throw new AppError(400, 'Email and password must be strings');
  }

  const email = body.email.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'A valid email address is required');
  }

  const passwordLength = Array.from(body.password).length;

  if (passwordLength < 12 || passwordLength > 128) {
    throw new AppError(400, 'Password must contain between 12 and 128 characters');
  }

  return { email, password: body.password };
}

export async function register(req: Request, res: Response<AuthenticationData>) {
  const credentials = parseCredentials(req.body);
  const result = await registerUser(credentials);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response<AuthenticationData>) {
  const credentials = parseCredentials(req.body);
  const result = await loginUser(credentials);
  res.json(result);
}

export function me(req: Request, res: Response<{ user: PublicUser }, UserLocals>) {
  if (!res.locals.user) {
    throw new AppError(401, 'Unauthorized');
  }

  res.json({ user: res.locals.user });
}
