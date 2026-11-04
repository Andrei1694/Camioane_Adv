import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import type { HashOptions } from 'argon2';
import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { createAuthenticationData } from '../lib/jwt.ts';
import { prisma } from '../lib/prisma.ts';
import type { AuthenticationData, PublicUser, UserCredentials } from '../types/user.ts';

const hashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } satisfies HashOptions;
let dummyHash: Promise<string> | undefined;

function getDummyHash() {
  // Unknown users still perform password verification instead of returning immediately.
  return dummyHash ??= hash(randomBytes(32).toString('hex'), hashOptions).catch((error: unknown) => {
    dummyHash = undefined;
    throw error;
  });
}

export async function registerUser(credentials: UserCredentials): Promise<AuthenticationData> {
  const email = credentials.email.trim().toLowerCase();
  const password = await hash(credentials.password, hashOptions);
  let user: PublicUser;

  try {
    user = await prisma.user.create({
      data: { email, password },
      select: { email: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Email is already registered');
    }

    throw error;
  }

  return createAuthenticationData(user);
}

export async function loginUser(credentials: UserCredentials): Promise<AuthenticationData> {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email.trim().toLowerCase() },
    select: { email: true, password: true },
  });
  const passwordHash = user?.password ?? await getDummyHash();
  const passwordMatches = await verify(passwordHash, credentials.password);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  return createAuthenticationData({ email: user.email });
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { email: true },
  });
}
