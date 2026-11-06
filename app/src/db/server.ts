import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type AdminDb = PostgresJsDatabase<typeof schema>

let db: AdminDb | undefined

/**
 * A direct Postgres connection that BYPASSES row-level security.
 *
 * Use it only where there is no signed-in user to act as (verified Stripe webhooks), or to write
 * tables that users must never write themselves (stripe_accounts) after the caller's permission has
 * already been checked. Everything else goes through the Supabase client, which is subject to RLS.
 *
 * DATABASE_URL should be a Supabase pooler string. prepare: false keeps it compatible with the
 * transaction pooler (port 6543), which suits serverless functions.
 */
export function adminDb(): AdminDb {
  if (db) return db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. The server needs it to process Stripe events.')
  db = drizzle(postgres(url, { prepare: false, max: 1 }), { schema })
  return db
}
