// Answers, in mock mode, the requests the app makes with fetch() itself rather than through the
// Neon client: the sign-in proxy (/api/auth/<slot>/…, see packages/auth-proxy), another
// account's organizations (the Data API's my_orgs), and the server functions for icons and files.

import { myOrgs } from './backend'
import { keyOfMockAddress, mockFileAddress, mockPdfAddress, readMockFile, writeMockFile } from './files'
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

async function answer(url: URL, init: RequestInit | undefined, real: typeof fetch): Promise<Response | null> {
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

  // Files (src/mock/files.ts). To show one, its mock address, which this file answers. To save
  // one to disk, an address of its bytes that the browser itself can open.
  if (url.pathname === '/api/files/url') {
    const key = url.searchParams.get('key') ?? ''
    if (url.searchParams.get('for') === 'show') return json({ url: mockFileAddress(key) })
    // As netlify/lib/file-serving.mjs: a frame is for a file named .pdf, sent as a PDF, and refused to any other.
    if (url.searchParams.get('for') === 'frame') {
      const name = getState().db.links.find((one) => one.file_key === key)?.file_name
      if (!/\.pdf$/i.test((name ?? '').trim())) return json({ error: "This file can't be shown in a frame. Download it instead." }, 400)
      return json({ url: mockPdfAddress(name!) })
    }
    return json({ url: URL.createObjectURL(await (await readMockFile(key, real)).blob()) })
  }
  if (url.pathname === '/api/files/upload') {
    const { name, type } = JSON.parse(String(init?.body ?? '{}')) as { name?: string; type?: string }
    // Only text written in the app (a document) is kept: there is nowhere to put a file from the computer.
    if (!type?.startsWith('text/')) return json({ error: 'Uploading files is off in mock mode.' }, 503)
    const key = `mock/${crypto.randomUUID()}/${name ?? 'document.md'}`
    return json({ key, uploadUrl: mockFileAddress(key) })
  }
  if (url.pathname === '/api/files/save') {
    const { key, size } = JSON.parse(String(init?.body ?? '{}')) as { key?: string; size?: number }
    const user = userOfToken(new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, ''))
    const { db } = getState()
    const link = db.links.find((one) => one.file_key === key)
    const member = link && db.members.find((one) => one.org_id === link.org_id && one.user_id === user?.id)
    const admin = link && member && db.space_members.some((row) => row.space_id === link.space_id && row.member_id === member.id && row.role === 'admin')
    if (!key || !admin) return json({ error: 'Only the admins of a space can change its files.' }, 403)
    update((draft) => {
      const saved = draft.db.links.find((one) => one.file_key === key)
      if (saved) saved.file_size = size ?? 0
    })
    return json({ uploadUrl: mockFileAddress(key) })
  }
  const file = keyOfMockAddress(url.pathname)
  if (file !== null) {
    if (init?.method !== 'PUT') return readMockFile(file, real)
    writeMockFile(file, await new Response(init.body).text())
    return new Response(null, { status: 200 })
  }
  return null
}

/** Puts the mock answers in front of the browser's fetch. */
export function installMockFetch() {
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const mocked = await answer(new URL(href, window.location.origin), init, real)
    return mocked ?? real(input, init)
  }
}
