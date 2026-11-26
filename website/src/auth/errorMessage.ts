import { ApiError } from '../lib/api'

export function authErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Cererea nu a putut fi finalizată. Încearcă din nou.'
  if (error.status === 401) return 'Adresa de e-mail sau parola este incorectă.'
  if (error.status === 429) return 'Prea multe încercări de autentificare. Încearcă din nou mai târziu.'
  if (error.status === 400) return 'Verifică adresa de e-mail și parola, apoi încearcă din nou.'
  if (error.message === 'The API took too long to respond. Please try again.') return 'Serverul nu a răspuns la timp. Încearcă din nou.'
  if (error.message.startsWith('The API returned an unexpected')) return 'Răspunsul serverului nu a putut fi verificat. Încearcă din nou.'
  return 'Serviciul de autentificare nu este disponibil momentan. Încearcă din nou mai târziu.'
}
