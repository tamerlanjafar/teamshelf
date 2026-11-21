// The requests that cost something each time, or reach someone else, kept under a low limit so
// they can't be run in a loop:
//
//   /api/auth/<org>/sign-in/*  →  sends a sign-in email (netlify/lib/auth-proxy.mjs)
//   GET /api/icon              →  fetches another site's page (netlify/lib/icon-api.mjs)
//   POST /api/files/upload     →  starts an upload (netlify/lib/files-api.mjs)
//
// Everything else the app asks for is netlify/functions/api.mjs.

import { handleAuthProxy } from '../lib/auth-proxy.mjs'
import files from '../lib/files-api.mjs'
import icon from '../lib/icon-api.mjs'
import { NEON_AUTH_URL } from '../lib/neon.mjs'

export const config = {
  path: ['/api/auth/:slot/sign-in/*', '/api/icon', '/api/files/upload'],
  // Each address (IP) gets this many of them a minute, then 429 until the minute is over. An
  // admin inviting a dozen people in a row, or a few colleagues signing in at once from one
  // office, stay under it. (Netlify's plans without Pro allow two such limits per site: this
  // one and api.mjs's. Uploads are also counted per person in the database.)
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export default function actions(request) {
  const { pathname } = new URL(request.url)
  if (pathname.startsWith('/api/auth/')) return handleAuthProxy(request, NEON_AUTH_URL)
  if (pathname === '/api/icon') return icon(request)
  return files(request)
}
