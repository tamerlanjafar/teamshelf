// Serves the built site (dist/client) the way Netlify does (netlify.toml): a file when there is
// one (the pages drawn at build time are /index.html, /login/index.html, /signup/index.html),
// and the app's shell (_shell.html) for every other address. Usage: pnpm build && pnpm preview.
//
// /api is answered by the same server functions Netlify runs (netlify/functions), with the
// variables of .env, so signing in and files work here as on the real site.

import dotenv from 'dotenv'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBrotliCompress } from 'node:zlib'

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const ROOT = fileURLToPath(new URL('../dist/client/', import.meta.url))
const PORT = 3013
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

/** The file for an address, as Netlify picks it: the file, its folder's index.html, or the shell. */
function fileFor(pathname) {
  const path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const direct = join(ROOT, path)
  if (existsSync(direct) && statSync(direct).isFile()) return direct
  const index = join(direct, 'index.html')
  if (existsSync(index)) return index
  return join(ROOT, '_shell.html')
}

// The two functions, as Netlify routes to them (the `path` of each one's config). Loaded after
// .env, which they read when they start.
const { default: actions } = await import('../netlify/functions/actions.mjs')
const { default: api } = await import('../netlify/functions/api.mjs')
const isAction = (pathname) => /^\/api\/auth\/[^/]+\/sign-in\//.test(pathname) || ['/api/icon', '/api/files/upload', '/api/files/save'].includes(pathname)
const isApi = (pathname) => pathname.startsWith('/api/auth/') || pathname === '/api/files/url'

/** Runs a server function for a request, the way Netlify does: a standard Request in, a Response out. */
async function serveFunction(incoming, outgoing, pathname) {
  try {
    const run = isAction(pathname) ? actions : isApi(pathname) ? api : null
    if (!run) {
      outgoing.writeHead(404, { 'content-type': 'application/json' })
      return outgoing.end(JSON.stringify({ error: 'not found' }))
    }
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    const headers = new Headers()
    for (const [name, value] of Object.entries(incoming.headers)) if (typeof value === 'string') headers.set(name, value)
    const method = incoming.method ?? 'GET'
    const answer = await run(new Request(`http://${incoming.headers.host}${incoming.url}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) }))
    outgoing.statusCode = answer.status
    answer.headers.forEach((value, name) => {
      if (name !== 'set-cookie') outgoing.setHeader(name, value)
    })
    outgoing.setHeader('set-cookie', answer.headers.getSetCookie())
    outgoing.end(Buffer.from(await answer.arrayBuffer()))
  } catch (error) {
    console.error(error)
    outgoing.writeHead(502, { 'content-type': 'application/json' })
    outgoing.end(JSON.stringify({ error: 'Something went wrong. Try again.' }))
  }
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  if (pathname.startsWith('/api/')) return void serveFunction(request, response, pathname)
  const file = fileFor(pathname)
  response.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
  if (file.includes(`${join(ROOT, 'assets')}`)) response.setHeader('cache-control', 'public, max-age=31536000, immutable')
  const stream = createReadStream(file).on('error', () => {
    // Missing while a build replaces dist: answer, and keep serving.
    response.statusCode = 404
    response.end()
  })
  // Compressed, as Netlify sends text files, so speed measured here is like the real site's.
  const text = /\.(html|js|css|json|svg|xml|txt|webmanifest)$/.test(file)
  if (text && /\bbr\b/.test(request.headers['accept-encoding'] ?? '')) {
    response.setHeader('content-encoding', 'br')
    stream.pipe(createBrotliCompress()).pipe(response)
  } else stream.pipe(response)
}).listen(PORT, () => console.log(`Built site on http://localhost:${PORT}`))
