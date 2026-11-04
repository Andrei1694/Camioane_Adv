import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import type { HashOptions } from 'argon2';
import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { createAuthenticationData } from '../lib/jwt.ts';
import { prisma } from '../lib/prisma.ts';
import { isRoleValid } from '../lib/role.ts';
import type { StorageLocation } from '../types/file.ts';
import type { CreateUserData, PublicUser, RoleName, SessionIdentity, SessionUser, UpdateUserData, UserCredentials, UserWithRole } from '../types/user.ts';

export const publicSelect = { id: true, email: true, role: true, avatar: { select: { updatedAt: true } } } as const;
const sessionSelect = { ...publicSelect, sessionVersion: true } as const;
const hashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } satisfies HashOptions;
let dummyHash: Promise<string> | undefined;

function getDummyHash() {
  return dummyHash ??= hash(randomBytes(32).toString('hex'), hashOptions).catch((error: unknown) => {
    dummyHash = undefined;
    throw error;
  });
}

export function publicUser(user: UserWithRole): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role.name,
    avatar: user.avatar ? { url: `/users/${user.id}/avatar`, updatedAt: user.avatar.updatedAt } : null,
  };
}

export async function loginUser(credentials: UserCredentials) {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
    select: { ...sessionSelect, password: true },
  });
  const passwordMatches = await verify(user?.password ?? await getDummyHash(), credentials.password);
  if (!user || !passwordMatches) throw new AppError(401, 'Invalid email or password');
  return createAuthenticationData({ ...publicUser(user), sessionVersion: user.sessionVersion });
}

export async function findSessionUser(id: string): Promise<SessionUser | null> {
  return prisma.user.findUnique({ where: { id }, select: sessionSelect });
}

function isWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  // adapter-pg can surface a commit-time serialization failure directly rather
  // than wrapping it in Prisma's P2034 error.
  return error instanceof Error && error.name === 'DriverAdapterError'
    && typeof error.cause === 'object' && error.cause !== null
    && 'kind' in error.cause && error.cause.kind === 'TransactionWriteConflict';
}

// Recheck the actor inside the same serializable transaction as each write.
// Retrying serialization conflicts prevents concurrent changes removing all admins.
async function transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(action, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isWriteConflict(error)) {
        if (attempt < 2) continue;
        throw new AppError(409, 'Accounts changed during this request. Refresh and try again.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new AppError(409, 'Email is already registered');
        if (error.code === 'P2025') throw new AppError(404, 'User not found');
      }
      throw error;
    }
  }
  throw new AppError(409, 'Accounts changed during this request. Refresh and try again.');
}

async function requireAdministrator(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: sessionSelect });
  if (!current || current.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (current.role.name !== 'ADMIN' || !isRoleValid(current.role)) {
    throw new AppError(403, 'Administrator access is required');
  }
}

async function resolveRole(tx: Prisma.TransactionClient, name: RoleName) {
  const role = await tx.role.findUnique({ where: { name } });
  if (!role) throw new AppError(409, 'The requested role is missing. Check role configuration.');
  return role;
}

export function listUsers(actor: SessionIdentity): Promise<PublicUser[]> {
  return transaction(async (tx) => {
    await requireAdministrator(tx, actor);
    const users = await tx.user.findMany({ select: publicSelect, orderBy: { email: 'asc' } });
    return users.map(publicUser);
  });
}

export async function createUser(actor: SessionIdentity, data: CreateUserData): Promise<PublicUser> {
  const password = await hash(data.password, hashOptions);
  return transaction(async (tx) => {
    await requireAdministrator(tx, actor);
    const role = await resolveRole(tx, data.role);
    return publicUser(await tx.user.create({
      data: { email: data.email, password, roleId: role.id },
      select: publicSelect,
    }));
  });
}

async function protectAdministrator(tx: Prisma.TransactionClient, target: UserWithRole) {
  if (target.role.name === 'ADMIN' && await tx.user.count({ where: { role: { name: 'ADMIN' } } }) <= 1) {
    throw new AppError(409, 'The last administrator cannot be removed or demoted');
  }
}

export async function updateUser(actor: SessionIdentity, id: string, data: UpdateUserData): Promise<PublicUser> {
  const password = data.password === undefined ? undefined : await hash(data.password, hashOptions);
  return transaction(async (tx) => {
    await requireAdministrator(tx, actor);
    const target = await tx.user.findUnique({ where: { id }, select: publicSelect });
    if (!target) throw new AppError(404, 'User not found');
    if (data.role !== undefined && data.role !== 'ADMIN' && target.role.name === 'ADMIN') {
      if (id === actor.id) throw new AppError(409, 'You cannot remove your own administrator access');
      await protectAdministrator(tx, target);
    }
    const role = data.role === undefined ? undefined : await resolveRole(tx, data.role);
    const changed = password !== undefined
      || (data.email !== undefined && data.email !== target.email)
      || (data.role !== undefined && data.role !== target.role.name);
    return publicUser(await tx.user.update({
      where: { id },
      data: {
        email: data.email,
        password,
        ...(role ? { roleId: role.id } : {}),
        ...(changed ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: publicSelect,
    }));
  });
}

// Returns the deleted profile picture's location: the row cascades, but the
// caller removes the stored object after the commit.
export function deleteUser(actor: SessionIdentity, id: string): Promise<StorageLocation | null> {
  return transaction(async (tx) => {
    await requireAdministrator(tx, actor);
    if (id === actor.id) throw new AppError(409, 'You cannot delete your own account');
    const target = await tx.user.findUnique({
      where: { id },
      select: { ...publicSelect, avatar: { select: { storageProvider: true, storageKey: true, updatedAt: true } } },
    });
    if (!target) throw new AppError(404, 'User not found');
    await protectAdministrator(tx, target);
    await tx.user.delete({ where: { id } });
    return target.avatar ? { provider: target.avatar.storageProvider, key: target.avatar.storageKey } : null;
  });
}

// Only the local bootstrap command calls this; it is never exposed over HTTP.
export async function bootstrapAdministrator(email: string, password?: string, promoteExisting = false): Promise<PublicUser> {
  const passwordHash = password === undefined ? undefined : await hash(password, hashOptions);
  return transaction(async (tx) => {
    const role = await resolveRole(tx, 'ADMIN');
    if (!isRoleValid(role)) {
      throw new AppError(409, 'The ADMIN role is inactive, not yet started, or expired. Check role configuration.');
    }
    const existing = await tx.user.findUnique({ where: { email }, select: publicSelect });
    if (existing?.role.name === 'ADMIN') return publicUser(existing);
    if (existing) {
      if (!promoteExisting) throw new AppError(409, 'Promotion of the existing account must be confirmed');
      return publicUser(await tx.user.update({
        where: { id: existing.id },
        data: { roleId: role.id, sessionVersion: { increment: 1 } },
        select: publicSelect,
      }));
    }
    if (!passwordHash) throw new AppError(400, 'A password is required for a new administrator');
    return publicUser(await tx.user.create({
      data: { email, password: passwordHash, roleId: role.id },
      select: publicSelect,
    }));
  });
}
