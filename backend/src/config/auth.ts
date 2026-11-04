export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET;

  if (!secret?.trim() || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be a randomly generated secret of at least 32 bytes.');
  }

  const frontendOrigin = env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  let origin: URL;

  try {
    origin = new URL(frontendOrigin);
  } catch {
    throw new Error('FRONTEND_ORIGIN must be an HTTP or HTTPS origin.');
  }

  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN must be an HTTP or HTTPS origin without a path.');
  }

  return { jwtSecret: new TextEncoder().encode(secret), frontendOrigin };
}

export const authConfig = loadAuthConfig();
