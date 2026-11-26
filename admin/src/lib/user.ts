export const roles = ['ADMIN', 'OPERATOR', 'DRIVER', 'USER'] as const
export type Role = typeof roles[number]

export const userStatuses = ['ACTIVE', 'DISABLED'] as const
export type UserStatus = typeof userStatuses[number]
export const userStatusLabels: Record<UserStatus, string> = { ACTIVE: 'Activ', DISABLED: 'Dezactivat' }

export function isUserStatus(value: unknown): value is UserStatus {
  return userStatuses.some((status) => status === value)
}

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
  DRIVER: 'Șofer',
  USER: 'Utilizator',
}

export function isRole(value: unknown): value is Role {
  return roles.some((role) => role === value)
}

/** A profile picture as the API describes it. `url` is relative to the API and needs the bearer token. */
export interface Avatar {
  url: string
  /** Changes with each upload, so it doubles as a cache key. */
  updatedAt: string
}

export interface User {
  id: string
  email: string
  role: Role
  avatar: Avatar | null
  displayName: string
  phone: string | null
  status: UserStatus
  createdAt: string
  lastLoginAt: string | null
}

export interface Credentials {
  email: string
  password: string
}

export interface UserInput {
  email: string
  role: Role
  password?: string
  displayName?: string
  phone?: string | null
  status?: UserStatus
}

export function getDisplayNameError(name: string): string | undefined {
  if (name.length > 200 || name.includes('\0')) return 'Numele poate avea cel mult 200 de caractere, fără caractere nule.'
}

export function getPhoneError(phone: string): string | undefined {
  if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) return 'Folosește formatul internațional, de exemplu +40712345678.'
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getEmailError(email: string): string | undefined {
  if (!email) return 'Introdu o adresă de e-mail.'
  if (email.length > 254) return 'Folosește o adresă de e-mail de cel mult 254 de caractere.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Introdu o adresă de e-mail validă.'
}

export function getPasswordError(password: string): string | undefined {
  const length = Array.from(password).length
  if (length < 12 || length > 128) return 'Folosește o parolă de 12–128 de caractere.'
}

// Mirror imageUploadTypes in backend/src/lib/file-validation.ts and avatarMaxUploadBytes in
// backend/src/lib/avatar-image.ts. The API sniffs the content and stays the authority; the
// browser uses these for the file picker and an early check.
export const avatarTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
export const avatarMaxBytes = 10 * 1024 * 1024
// 10 MiB is just over 10 MB, so promising 10 MB in decimal units (as DESIGN.md writes sizes) holds.
export const avatarMaxLabel = '10 MB'

/** Rejects a picture the API would refuse before any byte is sent. A blank type is left to the API. */
export function avatarFileError(file: File): string | undefined {
  if (file.size === 0) return `${file.name} este gol.`
  if (file.type && !avatarTypes.some((type) => type === file.type)) return `${file.name} nu este o imagine JPEG, PNG sau WebP.`
  if (file.size > avatarMaxBytes) return `${file.name} depășește ${avatarMaxLabel}.`
}
