// /api/auth/*  →  Neon Auth, with the session kept in a cookie on this site (packages/auth-proxy).

import { handleAuthProxy } from '@teamshelf/auth-proxy'

export const config = {
  path: '/api/auth/*',
  // Few people use the back office, so little is plenty: this many requests a minute for one address (IP).
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export default (request) => handleAuthProxy(request, process.env.VITE_NEON_AUTH_URL)
