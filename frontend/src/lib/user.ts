export const roles = ['ADMIN', 'OPERATOR', 'DRIVER', 'USER'] as const
export type Role = typeof roles[number]

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
}

export interface Credentials {
  email: string
  password: string
}

export interface UserInput {
  email: string
  role: Role
  password?: string
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
