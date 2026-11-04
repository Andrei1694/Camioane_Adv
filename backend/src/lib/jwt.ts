import { errors, jwtVerify, SignJWT } from 'jose';
import { authConfig } from '../config/auth.ts';
import type { AuthenticationData, PublicUser } from '../types/user.ts';
import { AppError } from './app-error.ts';

const issuer = 'camioane-api';
const audience = 'camioane-frontend';
const expiresIn = 3600;

export async function createAuthenticationData(user: PublicUser): Promise<AuthenticationData> {
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.email)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(authConfig.jwtSecret);

  return { user: { email: user.email }, accessToken, tokenType: 'Bearer', expiresIn };
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, authConfig.jwtSecret, {
      algorithms: ['HS256'],
      typ: 'JWT',
      issuer,
      audience,
      requiredClaims: ['sub', 'iat', 'exp'],
      maxTokenAge: expiresIn,
    });

    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new AppError(401, 'Unauthorized');
    }

    return payload.sub;
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      throw new AppError(401, 'Unauthorized');
    }

    throw error;
  }
}
