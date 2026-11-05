import { readFileSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

export const DB_URL = process.env.TEST_DATABASE_URL

const root = path.resolve(import.meta.dirname, '../..')

/** Recreate a clean database: Supabase stand-in, then every migration in journal order. */
export async function resetDatabase(sql: postgres.Sql) {
  await sql.unsafe(readFileSync(path.join(root, 'tests/db/supabase-stub.sql'), 'utf8'))
  const journal = JSON.parse(readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8')) as { entries: { tag: string }[] }
  for (const { tag } of journal.entries) {
    const file = readFileSync(path.join(root, 'drizzle', `${tag}.sql`), 'utf8')
    for (const statement of file.split('--> statement-breakpoint')) {
      if (statement.trim()) await sql.unsafe(statement)
    }
  }
  await sql.unsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated')
}

export async function createUser(sql: postgres.Sql, email: string, fullName: string) {
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO auth.users (email, raw_user_meta_data) VALUES (${email}, ${sql.json({ full_name: fullName })}) RETURNING id`
  return u.id
}

/** Run queries the way PostgREST would for a signed-in user (or anonymously when userId is null). */
export async function as<T>(sql: postgres.Sql, userId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${userId ? 'authenticated' : 'anon'}`)
    await tx`SELECT set_config('request.jwt.claim.sub', ${userId ?? ''}, true)`
    return fn(tx)
  })) as T
}
