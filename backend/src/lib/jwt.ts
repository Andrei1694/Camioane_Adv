import { errors, jwtVerify, SignJWT } from 'jose';
import { authConfig } from '../config/auth.ts';
import type { AuthenticationData, PublicUser, SessionIdentity } from '../types/user.ts';
import { AppError } from './app-error.ts';
import { isUserId } from './user-validation.ts';

const issuer = 'camioane-api';
const audience = 'camioane-frontend';
const expiresIn = 3600;

export async function createAuthenticationData(user: PublicUser & SessionIdentity): Promise<AuthenticationData> {
  const accessToken = await new SignJWT({ sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(authConfig.jwtSecret);

  return { user: { id: user.id, email: user.email, role: user.role }, accessToken, tokenType: 'Bearer', expiresIn };
}

export async function verifyAccessToken(token: string): Promise<SessionIdentity> {
  try {
    const { payload } = await jwtVerify(token, authConfig.jwtSecret, {
      algorithms: ['HS256'],
      typ: 'JWT',
      issuer,
      audience,
      requiredClaims: ['sub', 'iat', 'exp', 'sessionVersion'],
      maxTokenAge: expiresIn,
    });

    if (!isUserId(payload.sub) || typeof payload.sessionVersion !== 'number'
      || !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0) {
      throw new AppError(401, 'Unauthorized');
    }

    return { id: payload.sub, sessionVersion: payload.sessionVersion };
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      throw new AppError(401, 'Unauthorized');
    }

    throw error;
  }
}
