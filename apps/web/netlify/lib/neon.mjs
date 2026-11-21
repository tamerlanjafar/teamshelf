// What the server functions need to know about the Neon project, and checking who is calling.
//
// The two addresses are public (the browser uses them too). Functions get them from the
// variables set in Netlify, or from .env when run locally.

import { createRemoteJWKSet, jwtVerify } from 'jose'

export const NEON_AUTH_URL = process.env.VITE_NEON_AUTH_URL
export const NEON_DATA_API_URL = process.env.VITE_NEON_DATA_API_URL
if (!NEON_AUTH_URL || !NEON_DATA_API_URL) throw new Error('VITE_NEON_AUTH_URL and VITE_NEON_DATA_API_URL are not set (see SETUP.md).')

const keys = createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))

/** The caller's token, if it is a valid Neon Auth token. Null otherwise. */
export async function verifiedToken(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  try {
    await jwtVerify(token, keys)
    return token
  } catch {
    return null
  }
}

/** The Data API said no. `status` is its HTTP status; `message` is what the database said, when it did. */
export class DataApiError extends Error {
  constructor(status, body) {
    let said
    try {
      said = JSON.parse(body)
    } catch {
      said = null
    }
    super(typeof said?.message === 'string' ? said.message : `Data API ${status}`)
    this.status = status
    /** The Postgres (or Data API) error code, like 42501 or P0001. */
    this.code = typeof said?.code === 'string' ? said.code : undefined
  }
}

/**
 * Asks the Data API something as the caller, so the database's row-level security decides
 * what they may see, exactly as it does for the app. Returns the parsed answer, or throws a DataApiError.
 */
export async function asCaller(token, path, init = {}) {
  const response = await fetch(`${NEON_DATA_API_URL}/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json', ...init.headers },
  })
  if (!response.ok) throw new DataApiError(response.status, await response.text())
  return response.json()
}

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
