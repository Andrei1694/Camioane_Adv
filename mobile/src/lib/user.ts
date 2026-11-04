// Mirrors frontend/src/lib/user.ts. Keep the role list and validation rules in step with the backend.
export const roles = ['ADMIN', 'OPERATOR', 'DRIVER', 'USER'] as const
export type Role = typeof roles[number]

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  DRIVER: 'Driver',
  USER: 'User',
}

/** Roles this app is built for. Other accounts can sign in but see an explanation instead of the app. */
export const appRoles: readonly Role[] = ['DRIVER', 'OPERATOR']

export function isRole(value: unknown): value is Role {
  return roles.some((role) => role === value)
}

export interface User {
  id: string
  email: string
  role: Role
}

export interface Credentials {
  email: string
  password: string
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getEmailError(email: string): string | undefined {
  if (!email) return 'Enter an email address.'
  if (email.length > 254) return 'Use an email address with 254 characters or fewer.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
}

export function getPasswordError(password: string): string | undefined {
  const length = Array.from(password).length
  if (length < 12 || length > 128) return 'Use a password with 12–128 characters.'
}
