// Finds the icon a web page declares (<link rel="icon" href="…">).
//
// This runs on a server because a browser may not read another site's page. It fetches an
// address that a person typed in, so it is careful about where it goes: only http(s), never
// an address inside a private network, a few redirects at most, a short timeout, and it
// reads only the start of the page.

import { lookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'

const TIMEOUT_MS = 5000
const MAX_BYTES = 300_000
const MAX_REDIRECTS = 3
const MAX_ICON_BYTES = 48_000
const ICON_TYPES = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

// Addresses that are not on the public internet: this machine, private networks, link-local,
// carrier NAT, multicast, the ranges kept for documentation and tests, and the IPv6 ranges that
// carry an IPv4 address inside them (so "::ffff:7f00:1", 6to4 or NAT64 can't stand in for 127.0.0.1).
const PRIVATE = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
])
  PRIVATE.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [
  ['::', 96], // ::, ::1 and the old "IPv4-compatible" addresses
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32], // Teredo
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
])
  PRIVATE.addSubnet(network, prefix, 'ipv6')

/** Whether this IP address is one the lookup must never connect to. Anything that isn't an IP address counts as one. */
export function isPrivateAddress(address) {
  const family = isIP(address)
  if (family === 0) return true
  // An IPv4 address written as IPv6 (::ffff:a.b.c.d) is checked against the IPv4 ranges too.
  return PRIVATE.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * Resolves a host name for a connection, and refuses it when any of its addresses is private.
 * The connection uses the addresses checked here, so a name can't answer with a public address
 * for the check and a private one for the connection (DNS rebinding).
 */
function publicLookup(hostname, options, callback) {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error)
    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
      return callback(Object.assign(new Error(`${hostname} is not a public address`), { code: 'ENOTFOUND' }))
    }
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  })
}

/** The address as a URL, if it is one this function is willing to fetch. */
function publicUrl(address) {
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  // An address given as numbers is never looked up, so it is checked here. Names are checked
  // when the connection is made (publicLookup).
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || (isIP(host) && isPrivateAddress(host))) return null
  return url
}

/** One GET request. Resolves with the answer once its headers are in; the body is still to be read. */
function get(url, accept, signal) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'GET',
      // A connection of its own each time: never one kept open to a host checked earlier.
      agent: false,
      lookup: publicLookup,
      signal,
      headers: { accept, 'user-agent': 'Mozilla/5.0 (compatible; Teamshelf icon lookup)' },
    })
    request.on('response', resolve)
    request.on('error', reject)
    request.end()
  })
}

/**
 * The answer of the server at this address, following a few redirects, each checked like the
 * first address. All of it, the body included, has TIMEOUT_MS: after that the body stops with an error.
 */
async function fetchPublic(address, accept) {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let url = publicUrl(address)
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const response = await get(url, accept, signal)
    const next = response.headers.location
    if (response.statusCode >= 300 && response.statusCode < 400 && next) {
      response.destroy()
      let target
      try {
        target = new URL(next, url).href
      } catch {
        return null
      }
      url = publicUrl(target)
      continue
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return { url, response }
    response.destroy()
    return null
  }
  return null
}

/** The start of the page at this address. */
async function fetchPage(address) {
  const answer = await fetchPublic(address, 'text/html')
  if (!answer) return null
  const { url, response } = answer
  const decoder = new TextDecoder()
  let html = ''
  try {
    for await (const piece of response) {
      html += decoder.decode(piece, { stream: true })
      // Icons are declared in the head: no need to read further.
      if (html.length >= MAX_BYTES || /<\/head>/i.test(html)) break
    }
  } finally {
    response.destroy()
  }
  return { url, html }
}

/**
 * A small image as a `data:` address, or null when it is too big, not an image, or can't be fetched.
 * An https page may not show an image from an http address, so such an icon is kept as a copy.
 */
async function inlineImage(address) {
  const answer = await fetchPublic(address, 'image/*').catch(() => null)
  if (!answer) return null
  const { response } = answer
  const type = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  // Read piece by piece, and stop as soon as it is clearly too big.
  const pieces = []
  let size = 0
  try {
    if (!ICON_TYPES.includes(type)) return null
    for await (const piece of response) {
      size += piece.length
      if (size > MAX_ICON_BYTES) return null
      pieces.push(piece)
    }
  } catch {
    return null
  } finally {
    response.destroy()
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
