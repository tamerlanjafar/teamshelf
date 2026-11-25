// Signing in (/api/auth/<org>/…, packages/auth-proxy), answered at the edge: in Netlify's data
// center nearest the person, which then makes a short hop to Neon Auth. As a function in one
// region far from both, the session check every page opens with took about 430 ms.
//
// Sending a sign-in email (…/sign-in/*) stays with netlify/functions/actions.mjs and its much
// lower limit. netlify/functions/api.mjs still serves /api/auth too: for the local preview
// (scripts/preview.mjs), and as the fallback below.

import { handleAuthProxy } from '@teamshelf/auth-proxy'

export const config = {
  path: '/api/auth/*',
  excludedPath: '/api/auth/*/sign-in/*',
  // Each address (IP) gets this many requests a minute, then 429 until the minute is over. A
  // page makes a handful when it opens, so this is far above what people do, also many of them
  // behind one office address. Netlify counts; nothing is kept here. (Moved here from api.mjs:
  // Netlify allows two limits per site below its Pro plan.)
  rateLimit: { windowLimit: 600, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export default async (request, context) => {
  const neonAuthUrl = Netlify.env.get('VITE_NEON_AUTH_URL')
  // Not set up here, or failing before it could answer: the function in api.mjs answers instead.
  if (!neonAuthUrl) return context.next()
  try {
    return await handleAuthProxy(request, neonAuthUrl)
  } catch (error) {
    console.error('Auth at the edge failed, falling back to the function:', error)
    return context.next()
  }
}
