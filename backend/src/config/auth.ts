// CORS origins must match the browser's Origin header exactly: scheme, host and port only.
function parseOrigin(name: string, value: string) {
  let origin: URL;

  try {
    origin = new URL(value);
  } catch {
    throw new Error(`${name} must be an HTTP or HTTPS origin.`);
  }

  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== value) {
    throw new Error(`${name} must be an HTTP or HTTPS origin without a path.`);
  }

  return value;
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET;

  if (!secret?.trim() || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be a randomly generated secret of at least 32 bytes.');
  }

  return {
    jwtSecret: new TextEncoder().encode(secret),
    frontendOrigin: parseOrigin('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN ?? 'http://localhost:5173'),
    websiteOrigin: parseOrigin('WEBSITE_ORIGIN', env.WEBSITE_ORIGIN ?? 'http://localhost:5174'),
  };
}

export const authConfig = loadAuthConfig();
