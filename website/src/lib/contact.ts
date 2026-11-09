// vite.config.ts stops a build without an address; only development uses the reserved fallback.
const configured = import.meta.env.VITE_CONTACT_EMAIL?.trim()

export const contactEmail = configured || 'hello@example.com'

export const contactHref = `mailto:${contactEmail}?subject=${encodeURIComponent('Campanie publicitară')}`
