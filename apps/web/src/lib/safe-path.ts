/**
 * A path inside this app ("/acme/team?x=1"), or "/" for anything else. Keeps redirects on this site.
 * One "/" at the start isn't enough: a browser reads "/\evil.example" as "//evil.example". So the
 * path is resolved the way a browser does it, and kept only if it stays on the site.
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
