// Applies pending database migrations (drizzle/*.sql) before a production build, so deploying is the
// only step: Vercel runs `npm run vercel-build`, which runs this and then `next build`. If a migration
// fails, the build fails and the current deployment stays live.
//
// Records applied migrations in drizzle.__drizzle_migrations, the same table `npm run db:migrate`
// (drizzle-kit) uses, so the two can be mixed. Runs only for Vercel production builds: previews and
// local builds skip it, so they can never touch the production database.

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const onVercel = Boolean(process.env.VERCEL)
const production = process.env.VERCEL_ENV === 'production'
const forced = process.argv.includes('--force') // run outside a Vercel production build (e.g. to test against dev)

if (onVercel && !production) {
  console.log(`[migrate] Skipped: ${process.env.VERCEL_ENV} build (only production builds migrate).`)
  process.exit(0)
}
if (!onVercel && !forced) {
  console.log('[migrate] Skipped: not a Vercel production build. Use `npm run db:migrate` locally.')
  process.exit(0)
}

// MIGRATION_DATABASE_URL lets migrations use a different connection (e.g. the session pooler) if ever
// needed; otherwise the app's DATABASE_URL. prepare: false keeps the transaction pooler happy.
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DATABASE_URL is not set, so migrations cannot run. Failing the build.')
  process.exit(1)
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
const host = new URL(url).hostname
try {
  const before = await client`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }])
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  const [{ n }] = await client`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`
  console.log(`[migrate] ${host}: ${n - before[0].n} new migration(s) applied, ${n} total.`)
} catch (error) {
  console.error(`[migrate] Migration failed on ${host}. The build stops here, so the live site keeps running the previous version.`)
  console.error(error)
  process.exitCode = 1
} finally {
  await client.end()
}
