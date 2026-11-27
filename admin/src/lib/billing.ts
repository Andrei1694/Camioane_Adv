export interface Billing {
  companyName: string
  cui: string
  address: string
  email: string
  updatedAt: string
}

export type BillingInput = Omit<Billing, 'updatedAt'>

// Mirror backend/src/lib/billing-validation.ts; the API remains the authority.
export const maxCompanyNameLength = 200
export const maxAddressLength = 500
export const cuiPattern = /^(RO)?[1-9]\d{1,9}$/

export function normalizeCui(cui: string) {
  return cui.trim().toUpperCase().replace(/\s/g, '')
}

export function getCompanyNameError(companyName: string): string | undefined {
  if (!companyName) return 'Introdu denumirea firmei.'
  if (companyName.length > maxCompanyNameLength || companyName.includes('\0')) {
    return 'Denumirea firmei poate avea cel mult 200 de caractere, fără caractere nule.'
  }
}

export function getCuiError(cui: string): string | undefined {
  if (!cuiPattern.test(cui)) return 'Introdu 2–10 cifre, începând cu o cifră diferită de zero, cu prefixul RO opțional.'
}

export function getAddressError(address: string): string | undefined {
  if (!address) return 'Introdu adresa de facturare.'
  if (address.length > maxAddressLength || address.includes('\0')) {
    return 'Adresa poate avea cel mult 500 de caractere, fără caractere nule.'
  }
}

export function billingKey(revision: number, userId: string) {
  return ['billing', revision, userId] as const
}

export const emptyBillingInput: BillingInput = { companyName: '', cui: '', address: '', email: '' }

export function toBillingInput(billing: Billing | null): BillingInput {
  if (!billing) return { ...emptyBillingInput }
  return { companyName: billing.companyName, cui: billing.cui, address: billing.address, email: billing.email }
}
