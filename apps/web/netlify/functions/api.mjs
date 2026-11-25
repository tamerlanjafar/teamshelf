// What the app asks for all the time while it is open:
//
//   /api/auth/<org>/*   →  Neon Auth, keeping each organization's session in its own cookie on
//                          this site (packages/auth-proxy). On Netlify the edge function
//                          netlify/edge-functions/auth.mjs answers these first; this is the
//                          fallback, and what the local preview uses.
//   GET /api/files/url  →  a short-lived address to open a file at (netlify/lib/files-api.mjs)
//
// The costly requests (sending a sign-in email, looking up an icon, starting an upload) are
// netlify/functions/actions.mjs, with a much lower limit.

import { handleAuthProxy } from '@teamshelf/auth-proxy'
import files from '../lib/files-api.mjs'
import { NEON_AUTH_URL } from '../lib/neon.mjs'

export const config = {
  path: ['/api/auth/*', '/api/files/url'],
  excludedPath: ['/api/auth/:slot/sign-in/*'],
  // No rate limit here. Netlify's free plan allows two per site: one is in actions.mjs, the
  // other moved to the edge function that now answers /api/auth (edge-functions/auth.mjs).
  // What this function still serves, file addresses, needs a signed-in person.
}

export default (request) => (new URL(request.url).pathname.startsWith('/api/auth/') ? handleAuthProxy(request, NEON_AUTH_URL) : files(request))
