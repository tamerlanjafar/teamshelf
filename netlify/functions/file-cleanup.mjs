// Once a day: deletes from R2 the files whose link was deleted (or whose space or group was).
// The database lists them in public.file_trash (see db/migrations/012_spaces.sql).
//
// It connects as a role that can only read and clear that list: FILE_CLEANUP_DATABASE_URL.

import pg from 'pg'
import { deleteObject, r2Configured } from '../lib/r2.mjs'

export const config = { schedule: '@daily' }

export default async function cleanup() {
  const connectionString = process.env.FILE_CLEANUP_DATABASE_URL
  if (!r2Configured || !connectionString) {
    console.log('File cleanup is not set up.')
    return
  }
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    const { rows } = await client.query('select file_key from public.file_trash order by trashed_at limit 500')
    let deleted = 0
    for (const { file_key: key } of rows) {
      try {
        await deleteObject(key)
        await client.query('delete from public.file_trash where file_key = $1', [key])
        deleted += 1
      } catch (error) {
        console.error(`Could not delete ${key}:`, error)
      }
    }
    console.log(`Deleted ${deleted} of ${rows.length} files.`)
  } finally {
    await client.end()
  }
}
