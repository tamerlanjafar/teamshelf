// /api/auth/<org>/*  →  Neon Auth, keeping each organization's session in its own cookie on
// this site. See netlify/lib/auth-proxy.mjs.

import { handleAuthProxy } from '../lib/auth-proxy.mjs'
import { NEON_AUTH_URL } from '../lib/neon.mjs'

export const config = { path: '/api/auth/*' }

export default (request) => handleAuthProxy(request, NEON_AUTH_URL)
