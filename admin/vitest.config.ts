import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://dashboard.example.test' } },
    setupFiles: ['./tests/setup.ts'],
    env: {
      TZ: 'Europe/Bucharest',
      VITE_API_BASE_URL: 'https://api.example.test',
      VITE_MAP_STYLE_URL: 'https://map.example.test/style.json',
      VITE_ROUTING_API_URL: 'https://routing.example.test/route/v1',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
})
