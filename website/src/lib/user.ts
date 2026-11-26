export const roles = ['ADMIN', 'OPERATOR', 'DRIVER', 'USER'] as const
export type Role = typeof roles[number]

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
  DRIVER: 'Șofer',
  USER: 'Utilizator',
}

export interface User {
  id: string
  email: string
  displayName: string
  phone: string | null
  role: Role
  status: 'ACTIVE' | 'DISABLED'
  avatar: { url: string, updatedAt: string } | null
  createdAt: string
  lastLoginAt: string | null
}

export interface Credentials {
  email: string
  password: string
}

export interface LoginResult {
  user: User
  accessToken: string
  expiresIn: number
}

export function getEmailError(email: string) {
  if (!email) return 'Introdu o adresă de e-mail.'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Introdu o adresă de e-mail validă.'
}

export function getPasswordError(password: string) {
  const length = Array.from(password).length
  if (length < 12 || length > 128) return 'Introdu o parolă de 12–128 de caractere.'
}
