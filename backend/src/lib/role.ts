import type { Role } from '../generated/prisma/client.ts';
import { RoleName } from '../generated/prisma/enums.ts';

export function isRoleName(value: unknown): value is RoleName {
  return Object.values(RoleName).some((name) => name === value);
}

export function isRoleValid(role: Pick<Role, 'activ' | 'startDate' | 'endDate'>, now = new Date()): boolean {
  return role.activ && role.startDate <= now && (role.endDate === null || now < role.endDate);
}
