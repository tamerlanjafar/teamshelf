export const NEON_AUTH_URL: string
export const NEON_DATA_API_URL: string
export function verifiedToken(request: Request): Promise<string | null>
export function asCaller(token: string, path: string, init?: RequestInit): Promise<unknown>
export function json(body: unknown, status?: number): Response
