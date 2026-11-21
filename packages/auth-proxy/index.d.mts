/** Handles a request to /api/auth/<org>/<Neon Auth path>. See index.mjs. */
export function handleAuthProxy(request: Request, neonAuthUrl: string): Promise<Response>
export const AUTH_PATH: string
export const NEW_SLOT: string
