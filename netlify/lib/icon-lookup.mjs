// Finds the icon a web page declares (<link rel="icon" href="…">).
//
// This runs on a server because a browser may not read another site's page. It fetches an
// address that a person typed in, so it is careful about where it goes: only http(s), never
// an address inside a private network, a few redirects at most, a short timeout, and it
// reads only the start of the page.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 5000
const MAX_BYTES = 300_000
const MAX_REDIRECTS = 3
const MAX_ICON_BYTES = 48_000
const ICON_TYPES = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

/** Addresses that are not on the public internet: this machine, private networks, link-local, and the like. */
function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const text = address.toLowerCase()
  if (text.startsWith('::ffff:')) return isPrivateAddress(text.slice(7))
  return text === '::' || text === '::1' || text.startsWith('fc') || text.startsWith('fd') || text.startsWith('fe8') || text.startsWith('fe9') || text.startsWith('fea') || text.startsWith('feb')
}

/** The address as a URL, if it is one this function is willing to fetch. */
async function publicUrl(address) {
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address)
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) return null
  return url
}

/** The answer of the server at this address, following a few redirects, each checked like the first address. */
async function fetchPublic(address, accept) {
  let url = await publicUrl(address)
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept, 'user-agent': 'Mozilla/5.0 (compatible; Teamshelf icon lookup)' },
    })
    const next = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && next) {
      url = await publicUrl(new URL(next, url).href)
      continue
    }
    return response.ok && response.body ? { url, response } : null
  }
  return null
}

/** The start of the page at this address. */
async function fetchPage(address) {
  const answer = await fetchPublic(address, 'text/html')
  if (!answer) return null
  const { url, response } = answer
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let html = ''
  while (html.length < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value, { stream: true })
    // Icons are declared in the head: no need to read further.
    if (/<\/head>/i.test(html)) break
  }
  reader.cancel().catch(() => {})
  return { url, html }
}

/**
 * A small image as a `data:` address, or null when it is too big, not an image, or can't be fetched.
 * An https page may not show an image from an http address, so such an icon is kept as a copy.
 */
async function inlineImage(address) {
  const answer = await fetchPublic(address, 'image/*').catch(() => null)
  if (!answer) return null
  const type = (answer.response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!ICON_TYPES.includes(type)) return null
  // Read piece by piece, and stop as soon as it is clearly too big.
  const pieces = []
  let size = 0
  for await (const piece of answer.response.body) {
    size += piece.length
    if (size > MAX_ICON_BYTES) return null
    pieces.push(piece)
  }
  if (size === 0) return null
  const bytes = Buffer.concat(pieces)
  return `data:${type};base64,${bytes.toString('base64')}`
}

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined)

/** How good an icon declaration is for a small square: a plain icon first, then the bigger special ones. */
function rank(rel) {
  const names = rel.toLowerCase().split(/\s+/)
  if (names.includes('icon')) return names.includes('shortcut') ? 1 : 0
  if (names.includes('apple-touch-icon') || names.includes('apple-touch-icon-precomposed')) return 2
  return names.some((name) => name.includes('icon')) && !names.includes('mask-icon') ? 3 : -1
}

/**
 * The icon the page at `address` declares, or null. A full web address, except for an icon
 * served over plain http: that one comes back as a `data:` copy of the image, when it is small.
 */
export async function findIcon(address) {
  const page = await fetchPage(address).catch(() => null)
  if (!page) return null

  const found = []
  for (const [tag] of page.html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attribute(tag, 'rel')
    const href = attribute(tag, 'href')
    if (!rel || !href || rank(rel) < 0) continue
    try {
      const icon = new URL(href.replace(/&amp;/g, '&'), page.url)
      if (icon.protocol === 'http:' || icon.protocol === 'https:') found.push({ rank: rank(rel), href: icon.href })
    } catch {
      // Not an address: skip it.
    }
  }
  found.sort((a, b) => a.rank - b.rank)
  const icon = found[0]?.href ?? null
  if (!icon?.startsWith('http:')) return icon
  return (await inlineImage(icon)) ?? icon
}
