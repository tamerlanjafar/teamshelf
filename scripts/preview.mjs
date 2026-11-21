// Serves the built site (dist/client) the way Netlify does (netlify.toml): a file when there is
// one (the pages drawn at build time are /index.html, /login/index.html, /signup/index.html),
// and the app's shell (_shell.html) for every other address. Usage: pnpm build && pnpm preview.
// The port is assigned in ~/Documents/DEV_PORTS.md. /api is not served: sign-in needs `pnpm dev`.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBrotliCompress } from 'node:zlib'

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

createServer((request, response) => {
  const file = fileFor(new URL(request.url ?? '/', 'http://localhost').pathname)
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
