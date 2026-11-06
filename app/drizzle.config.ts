import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Local commands read app/.env.local. Variables already set in the shell win, so
// `DATABASE_URL=… npx drizzle-kit migrate` still targets that database (e.g. production).
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
