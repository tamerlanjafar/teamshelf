// GET /api/icon?url=<address>  →  { "icon": "<address of the page's icon>" | null }
//
// Served by netlify/functions/actions.mjs. Used by the app when a link is saved. Only for people who are signed in: the caller sends
// the same token it uses for the database, and it is verified against Neon Auth's public keys.

import { findIcon } from './icon-lookup.mjs'
import { json, verifiedToken } from './neon.mjs'

export default async function icon(request) {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)
  if (!(await verifiedToken(request))) return json({ error: 'sign in first' }, 401)

  const address = new URL(request.url).searchParams.get('url') ?? ''
  if (address.length === 0 || address.length > 2000) return json({ error: 'give a url' }, 400)
  return json({ icon: await findIcon(address) })
}
