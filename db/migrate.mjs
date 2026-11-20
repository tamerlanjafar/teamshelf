// Applies the SQL files in db/migrations that this database hasn't seen yet, in name order.
// Usage: pnpm db:migrate (reads DATABASE_URL from .env).

import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const folder = fileURLToPath(new URL('./migrations/', import.meta.url))

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

try {
  await client.query('create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const { rows } = await client.query('select name from public.schema_migrations')
  const applied = new Set(rows.map((row) => row.name))
  const files = (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()

  for (const name of files) {
    if (applied.has(name)) continue
    const sql = await readFile(folder + name, 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into public.schema_migrations (name) values ($1)', [name])
      await client.query('commit')
      console.log(`applied ${name}`)
    } catch (error) {
      await client.query('rollback')
      throw new Error(`${name} failed: ${error.message}`)
    }
  }
  console.log('Database is up to date.')
  // The Data API keeps its own copy of the schema, and only Neon can make it read the schema again.
  if (files.some((name) => !applied.has(name))) {
    console.log('Now refresh the Data API: Neon Console → Data API → "Refresh schema cache". Until then it does not know the new tables and functions.')
  }
} finally {
  await client.end()
}
