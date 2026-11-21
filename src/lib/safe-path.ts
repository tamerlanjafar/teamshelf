/**
 * A path inside this app ("/acme/team?x=1"), or "/" for anything else. Keeps redirects on this site.
 *
 * Starting with one "/" isn't enough to be on this site: a browser reads "/\evil.example" and
 * "/<tab>/evil.example" as "//evil.example", another site. So the path is read the way a browser
 * reads it, against a site that doesn't exist, and kept only if it stays there.
 */
export function safePath(path: string | undefined): string {
  if (!path || !path.startsWith('/')) return '/'
  const base = 'https://teamshelf.invalid'
  try {
    const url = new URL(path, base)
    if (url.origin !== base) return '/'
    const clean = url.pathname + url.search + url.hash
    // What the browser made of it must again be a path of this site, with no "//" or "\" at its start.
    return /^\/(?![/\\])/.test(clean) ? clean : '/'
  } catch {
    return '/'
  }
}
