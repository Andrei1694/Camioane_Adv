import './env.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hash } from 'argon2';
import { isRoleValid } from '../../src/lib/role.ts';
import { prisma } from '../../src/lib/prisma.ts';
import type { RoleName } from '../../src/types/user.ts';
import { signToken } from './api.ts';

export const password = '  a safe test passphrase  ';
let passwordHash: Promise<string> | undefined;
const roleIds = new Map<RoleName, string>();

export interface FixtureUser {
  id: string;
  email: string;
  role: RoleName;
  sessionVersion: number;
  token: string;
}

// Integration tests need the built-in roles and a currently valid ADMIN role.
// They never change shared roles or existing accounts.
export async function requireDatabase() {
  await prisma.$queryRaw`SELECT 1`;
  const admin = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  assert.ok(admin && isRoleValid(admin),
    'Integration tests require the migrated development database with an active ADMIN role');
}

async function roleId(name: RoleName) {
  let id = roleIds.get(name);
  if (!id) {
    id = (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
    roleIds.set(name, id);
  }
  return id;
}

// Tracks every row a test creates so cleanup removes only those rows.
export class Fixtures {
  readonly emails = new Set<string>();
  readonly fileIds = new Set<string>();
  readonly purchaseIds = new Set<string>();

  email(prefix = 'test') {
    const email = `${prefix}-${randomUUID()}@example.test`;
    this.emails.add(email);
    return email;
  }

  // Inserts the account directly and signs its token, so setup never uses the
  // login rate limit or the API under test.
  async user(role: RoleName = 'USER', email = this.email()): Promise<FixtureUser> {
    this.emails.add(email);
    passwordHash ??= hash(password);
    const user = await prisma.user.create({
      data: { email, password: await passwordHash, roleId: await roleId(role) },
    });
    return {
      id: user.id,
      email,
      role,
      sessionVersion: user.sessionVersion,
      token: await signToken(user.id, { sessionVersion: user.sessionVersion }),
    };
  }

  async cleanup() {
    const users = await prisma.user.findMany({ where: { email: { in: [...this.emails] } }, select: { id: true } });
    const ids = users.map((user) => user.id);
    const purchaseIds = [...this.purchaseIds];
    // Ledger rows first: their purchase reference is RESTRICT.
    await prisma.creditTransaction.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { createdById: { in: ids } }, { purchaseId: { in: purchaseIds } }] },
    });
    await prisma.creditPurchase.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { settledById: { in: ids } }, { id: { in: purchaseIds } }] },
    });
    await prisma.uploadedFile.deleteMany({ where: { OR: [{ ownerId: { in: ids } }, { id: { in: [...this.fileIds] } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    this.emails.clear();
    this.fileIds.clear();
    this.purchaseIds.clear();
  }
}
