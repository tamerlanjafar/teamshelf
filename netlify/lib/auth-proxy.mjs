// Signing in goes through this site (/api/auth/<org>/…) instead of straight to Neon Auth, so
// that one browser can stay signed in to several accounts at once, like Slack.
//
// Neon Auth keeps a session in a cookie. Passing through here, that cookie is kept on this site,
// under the path of an organization: the session for /acme lives at
// /api/auth/acme, the one for /otherco at /api/auth/otherco. The browser only sends a
// cookie to its own path, so each organization's session stays apart from the others, and they
// can belong to different accounts (different emails).
//
// A sign-in starts at /api/auth/_new, before it is known which organizations the account is in.
// The app then copies the session to each of its organizations (~copy) and clears _new (~forget).

import { handleAuthRequest, NEON_AUTH_COOKIE_PREFIX, parseSetCookies, serializeSetCookie } from '@neondatabase/neon-js/auth/server'

/** Where the proxy is served. Keep in step with src/lib/accounts.ts. */
export const AUTH_PATH = '/api/auth'

/** The session of a sign-in that isn't tied to an organization yet. Not a valid organization address. */
export const NEW_SLOT = '_new'

// The shape of an organization's address (db/migrations/002_organizations.sql), or _new.
const SLOT = /^(?:[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?|_new)$/
const isSlot = (value) => typeof value === 'string' && value.length >= 2 && SLOT.test(value)

/** How long a copied session cookie is kept. Neon Auth sessions last a week, and are renewed while used. */
const COPY_MAX_AGE = 7 * 24 * 60 * 60

// Headers of Neon Auth's answers that the browser needs. Not content-encoding: fetch has
// already unpacked the body.
const PASSED_HEADERS = ['content-type', 'set-auth-jwt', 'set-auth-token', 'date']

const json = (body, status = 200, headers = new Headers()) => {
  headers.set('content-type', 'application/json')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

const cookiePath = (slot) => `${AUTH_PATH}/${slot}`

/** A cookie for this site, at the organization's path. */
const cookieFor = (slot, cookie) =>
  serializeSetCookie({ ...cookie, path: cookiePath(slot), domain: undefined, partitioned: undefined, secure: true, httpOnly: true, sameSite: 'lax' })

/** The Neon Auth cookies the browser sent with this request (only those of its path). */
function sentCookies(request) {
  const header = request.headers.get('cookie') ?? ''
  return header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(NEON_AUTH_COOKIE_PREFIX))
    .map((part) => {
      const at = part.indexOf('=')
      return { name: part.slice(0, at), value: decodeURIComponent(part.slice(at + 1)) }
    })
}

async function slotsIn(request) {
  try {
    const { slots } = await request.json()
    return Array.isArray(slots) && slots.length <= 50 && slots.every(isSlot) ? slots : null
  } catch {
    return null
  }
}

/** Handles a request to /api/auth/<slot>/<Neon Auth path>. Standard Request in, Response out. */
export async function handleAuthProxy(request, neonAuthUrl) {
  const url = new URL(request.url)
  const [slot, ...rest] = url.pathname.slice(AUTH_PATH.length + 1).split('/')
  const path = rest.join('/')
  if (!isSlot(slot) || !path) return json({ error: 'not found' }, 404)

  // Copies this path's session to other organizations' paths: { slots: ['otherco', …] }.
  if (path === '~copy') {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)
    const slots = await slotsIn(request)
    if (!slots) return json({ error: 'give slots' }, 400)
    const session = sentCookies(request).filter((cookie) => !cookie.name.includes('challenge'))
    if (!session.length) return json({ error: 'not signed in' }, 401)
    const headers = new Headers()
    for (const target of slots) for (const cookie of session) headers.append('set-cookie', cookieFor(target, { ...cookie, maxAge: COPY_MAX_AGE }))
    return json({ copied: slots }, 200, headers)
  }

  // Forgets the sessions kept at these paths (signing out happens at Neon Auth first): { slots: [...] }.
  if (path === '~forget') {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)
    const slots = await slotsIn(request)
    if (!slots) return json({ error: 'give slots' }, 400)
    const names = ['session_token', 'session_data', 'dont_remember'].map((name) => `${NEON_AUTH_COOKIE_PREFIX}.${name}`)
    const headers = new Headers()
    for (const target of slots) for (const name of names) headers.append('set-cookie', cookieFor(target, { name, value: '', maxAge: 0 }))
    return json({ forgotten: slots }, 200, headers)
  }

  const upstream = await handleAuthRequest(neonAuthUrl, request, path)
  const headers = new Headers()
  for (const name of PASSED_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  for (const header of upstream.headers.getSetCookie()) for (const cookie of parseSetCookies(header)) headers.append('set-cookie', cookieFor(slot, cookie))
  headers.set('cache-control', 'no-store')
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}
