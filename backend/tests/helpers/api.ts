import './env.ts';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { createApp } from '../../src/app.ts';

export const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface RequestOptions {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

export async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

export async function listen(server: Server) {
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function encode(body: unknown): { body?: BodyInit; json: boolean } {
  if (body === undefined) return { json: false };
  if (body instanceof FormData || typeof body === 'string') return { body, json: false };
  if (body instanceof Uint8Array) return { body: new Uint8Array(body), json: false };
  return { body: JSON.stringify(body), json: true };
}

// Starts an isolated app on a random port. Each app has its own login limiter.
export async function startServer(options: Parameters<typeof createApp>[0] = {}) {
  const server = createApp(options).listen(0, '127.0.0.1');
  const baseUrl = await listen(server);

  function request(method: string, path: string, { body, token, headers = {} }: RequestOptions = {}) {
    const encoded = encode(body);
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(encoded.json ? { 'Content-Type': 'application/json' } : {}),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      ...(encoded.body === undefined ? {} : { body: encoded.body }),
    });
  }

  return { server, baseUrl, request, close: () => closeServer(server) };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;

/** Polls until the condition holds, for effects that finish after a client leaves. */
export async function eventually(condition: () => boolean | Promise<boolean>, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!await condition()) {
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Resolves once the server sees its next connection close. */
export function nextConnectionClosed(server: Server) {
  return new Promise<void>((resolve) => {
    server.once('connection', (socket) => socket.once('close', () => resolve()));
  });
}

export async function signToken(id: string, claims: JWTPayload = {}, algorithm = 'HS256', key: Uint8Array = secret) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: id,
    sessionVersion: 0,
    iss: 'camioane-api',
    aud: 'camioane-frontend',
    iat: now,
    exp: now + 3600,
    ...claims,
  }).setProtectedHeader({ alg: algorithm, typ: 'JWT' }).sign(key);
}
