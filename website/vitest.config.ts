import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://website.example.test' } },
    setupFiles: ['./tests/setup.ts'],
    env: {
      VITE_CONTACT_EMAIL: 'campaign@example.com',
      VITE_API_BASE_URL: 'https://api.example.test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
})
