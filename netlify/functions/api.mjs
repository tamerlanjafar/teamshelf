// What the app asks for all the time while it is open:
//
//   /api/auth/<org>/*   →  Neon Auth, keeping each organization's session in its own cookie on
//                          this site (netlify/lib/auth-proxy.mjs)
//   GET /api/files/url  →  a short-lived address to open a file at (netlify/lib/files-api.mjs)
//
// The costly requests (sending a sign-in email, looking up an icon, starting an upload) are
// netlify/functions/actions.mjs, with a much lower limit.

import { handleAuthProxy } from '../lib/auth-proxy.mjs'
import files from '../lib/files-api.mjs'
import { NEON_AUTH_URL } from '../lib/neon.mjs'

export const config = {
  path: ['/api/auth/*', '/api/files/url'],
  excludedPath: ['/api/auth/:slot/sign-in/*'],
  // Each address (IP) gets this many requests a minute, then 429 until the minute is over. A
  // page makes a handful when it opens, so this is far above what people do, also many of them
  // behind one office address. Netlify counts; nothing is kept here.
  rateLimit: { windowLimit: 600, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export default (request) => (new URL(request.url).pathname.startsWith('/api/auth/') ? handleAuthProxy(request, NEON_AUTH_URL) : files(request))
