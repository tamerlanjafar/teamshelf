// Looks up the icon of every link that has none saved yet. Links get theirs when they are
// saved in the app, so this is only for links from before that, or after a site changed its icon.
// Usage: node db/backfill-icons.mjs  (reads DATABASE_URL from .env)

import 'dotenv/config'
import pg from 'pg'
import { findIcon } from '../netlify/lib/icon-lookup.mjs'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

try {
  const { rows } = await client.query('select id, title, url from public.links where icon_url is null order by created_at')
  for (const link of rows) {
    const icon = await findIcon(link.url)
    if (icon) await client.query('update public.links set icon_url = $1 where id = $2', [icon, link.id])
    console.log(`${icon ? 'found  ' : 'none   '} ${link.title}  ${icon ?? ''}`)
  }
  console.log(`${rows.length} link(s) checked.`)
} finally {
  await client.end()
}
