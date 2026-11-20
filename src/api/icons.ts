import { neon } from '@/lib/neon'

/** A web address, or a small image carried in the address itself (the copy kept of an icon served over http). */
const isIcon = (icon: string) => (/^https?:\/\//i.test(icon) && icon.length <= 2000) || (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(icon) && icon.length <= 70000)

/**
 * Asks the server for the icon the page at this address declares (see netlify/functions/icon.mjs).
 * A browser may not read another site's page itself. Returns null when there is none, when the
 * page can't be reached from the server (an internal address), or when the lookup isn't there.
 * It never fails: a link is saved with or without an icon.
 */
export async function findIcon(url: string): Promise<string | null> {
  try {
    // The same signed token the database calls carry. The function checks its signature.
    const token = (await neon.auth.getSession()).data?.session?.token
    const response = await fetch(`/api/icon?url=${encodeURIComponent(url)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(7000),
    })
    if (!response.ok) return null
    const answer = (await response.json()) as { icon?: unknown }
    return typeof answer.icon === 'string' && isIcon(answer.icon) ? answer.icon : null
  } catch {
    return null
  }
}
