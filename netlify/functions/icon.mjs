// GET /api/icon?url=<address>  →  { "icon": "<address of the page's icon>" | null }
//
// Used by the app when a link is saved. Only for people who are signed in: the caller sends
// the same token it uses for the database, and it is verified against Neon Auth's public keys.

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { findIcon } from '../lib/icon-lookup.mjs'

export const config = { path: '/api/icon' }

const authUrl = process.env.VITE_NEON_AUTH_URL
const keys = authUrl ? createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`)) : null

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function signedIn(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token || !keys) return false
  try {
    await jwtVerify(token, keys)
    return true
  } catch {
    return false
  }
}

export default async function icon(request) {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)
  if (!(await signedIn(request))) return json({ error: 'sign in first' }, 401)

  const address = new URL(request.url).searchParams.get('url') ?? ''
  if (address.length === 0 || address.length > 2000) return json({ error: 'give a url' }, 400)
  return json({ icon: await findIcon(address) })
}
