import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // The contact address is the page's only call to action, so a build must carry a real one.
  // Development falls back to a reserved example address in src/lib/contact.ts.
  const contactEmail = loadEnv(mode, process.cwd(), 'VITE_').VITE_CONTACT_EMAIL?.trim()
  if (command === 'build' && !contactEmail?.match(/^[^\s@]+@[^\s@]+$/)) {
    throw new Error('Set VITE_CONTACT_EMAIL to the address the website should show (see .env.example) before building.')
  }
  return {
    plugins: [react()],
    // 5173 is the admin app's port; the backend's WEBSITE_ORIGIN allows 5174 by default.
    server: { port: 5174, strictPort: true },
    preview: { port: 5174, strictPort: true },
  }
})
