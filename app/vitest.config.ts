import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // server-only throws outside Next's server build; tests import server modules directly.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src'), 'server-only': path.resolve(import.meta.dirname, './tests/server-only.ts') } },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'db', include: ['tests/db/**/*.test.ts'], environment: 'node', testTimeout: 30000 } },
    ],
  },
})
