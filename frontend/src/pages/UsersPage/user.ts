export interface User {
  email: string
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getEmailError(email: string): string | undefined {
  if (!email) return 'Enter an email address.'
  if (email.length > 254) return 'Use an email address with 254 characters or fewer.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
}
