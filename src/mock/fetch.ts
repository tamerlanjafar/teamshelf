// Answers, in mock mode, the requests the app makes with fetch() itself rather than through the
// Neon client: the sign-in proxy (/api/auth/<slot>/…, see netlify/lib/auth-proxy.mjs), another
// account's organizations (the Data API's my_orgs), and the server functions for icons and files.

import { myOrgs } from './backend'
import { getState, update, userOfSlot, userOfToken } from './store'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

async function slotsOf(init?: RequestInit): Promise<string[]> {
  try {
    const { slots } = JSON.parse(String(init?.body ?? '{}')) as { slots?: string[] }
    return Array.isArray(slots) ? slots : []
  } catch {
    return []
  }
}

async function answer(url: URL, init?: RequestInit): Promise<Response | null> {
  const auth = url.pathname.match(/^\/api\/auth\/([^/]+)\/(.+)$/)
  if (auth) {
    const [, slot, path] = auth
    const token = getState().sessions[slot]
    switch (path) {
      case '~copy': {
        const targets = await slotsOf(init)
        if (!token) return json({ error: 'not signed in' }, 401)
        update((draft) => {
          for (const target of targets) draft.sessions[target] = token
        })
        return json({ copied: targets })
      }
      case '~forget': {
        const targets = await slotsOf(init)
        update((draft) => {
          for (const target of targets) delete draft.sessions[target]
        })
        return json({ forgotten: targets })
      }
      case 'sign-out':
        // Ends the session everywhere its token was copied, as Neon Auth would.
        update((draft) => {
          if (token) delete draft.tokens[token]
        })
        return json({ success: true })
      case 'get-session': {
        const user = userOfSlot(slot)
        return user ? json({ user, session: { token, userId: user.id } }, 200, { 'set-auth-jwt': token }) : json(null)
      }
      case 'token':
        return userOfSlot(slot) ? json({ token }) : json({ error: 'not signed in' }, 401)
      default:
        return json({ error: `${path} isn't part of mock mode` }, 404)
    }
  }

  if (url.pathname.endsWith('/rpc/my_orgs') && url.origin === new URL(import.meta.env.VITE_NEON_DATA_API_URL).origin) {
    const token = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '')
    const user = userOfToken(token)
    return user ? json(myOrgs(user)) : json({ message: 'not signed in' }, 401)
  }

  if (url.pathname === '/api/icon') return json({ icon: null })
  if (url.pathname === '/api/files/url') return json({ url: 'https://example.com/' })
  if (url.pathname === '/api/files/upload') return json({ error: 'Uploading files is off in mock mode.' }, 503)
  return null
}

/** Puts the mock answers in front of the browser's fetch. */
export function installMockFetch() {
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const mocked = await answer(new URL(href, window.location.origin), init)
    return mocked ?? real(input, init)
  }
}
