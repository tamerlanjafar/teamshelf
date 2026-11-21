import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * On Netlify, /api/icon is a function (netlify/functions/icon.mjs). This gives the dev server
 * the same address with the same lookup, without the sign-in check (it only listens locally).
 */
const iconLookup = (): Plugin => ({
  name: 'teamshelf-icon-lookup',
  configureServer(server) {
    server.middlewares.use('/api/icon', async (request, response) => {
      const { findIcon } = await import('./netlify/lib/icon-lookup.mjs')
      const address = new URL(request.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ icon: await findIcon(address) }))
    })
  },
})

/**
 * On Netlify, /api/auth/<org>/* is a function (netlify/functions/auth.mjs) that keeps each
 * organization's session in its own cookie. The dev server runs the same code.
 */
const authProxy = (): Plugin => ({
  name: 'teamshelf-auth-proxy',
  configureServer(server) {
    server.middlewares.use('/api/auth', async (incoming, outgoing) => {
      const { handleAuthProxy } = await import('./netlify/lib/auth-proxy.mjs')
      const { NEON_AUTH_URL } = await import('./netlify/lib/neon.mjs')
      const chunks: Buffer[] = []
      for await (const chunk of incoming) chunks.push(chunk as Buffer)
      const headers = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) if (typeof value === 'string') headers.set(name, value)
      const method = incoming.method ?? 'GET'
      // Connect strips the mount path from url; originalUrl keeps it.
      const path = (incoming as typeof incoming & { originalUrl?: string }).originalUrl ?? incoming.url ?? ''
      const request = new Request(`http://${incoming.headers.host}${path}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) })
      const response = await handleAuthProxy(request, NEON_AUTH_URL)
      outgoing.statusCode = response.status
      response.headers.forEach((value, name) => {
        if (name !== 'set-cookie') outgoing.setHeader(name, value)
      })
      outgoing.setHeader('set-cookie', response.headers.getSetCookie())
      outgoing.end(Buffer.from(await response.arrayBuffer()))
    })
  },
})

// Unique per build: baked into the bundle as `__APP_VERSION__` and served as /version.json,
// so an open tab can tell that a newer deploy is live (src/lib/app-version.ts).
const appVersion = Date.now().toString(36)

const appVersionFile = (): Plugin => ({
  name: 'teamshelf-app-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: appVersion }) })
  },
})

/**
 * Link previews (Slack, Teams, WhatsApp) need full addresses for the page and its picture.
 * Netlify gives the site's address as URL when it builds. Elsewhere the tags stay relative.
 */
const siteAddress = (): Plugin => ({
  name: 'teamshelf-site-address',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', (process.env.URL ?? '').replace(/\/$/, '')),
})

/**
 * Mock mode (`pnpm dev:mock`, src/mock): the Neon client is swapped for one that answers from
 * made-up data in the browser, so nothing reaches Neon, R2 or the icon lookup.
 */
const mockAliases = [
  { find: /^@neondatabase\/neon-js$/, replacement: fileURLToPath(new URL('./src/mock/neon-client.ts', import.meta.url)) },
  { find: /^@neondatabase\/neon-js\/auth\/react\/adapters$/, replacement: fileURLToPath(new URL('./src/mock/neon-adapters.ts', import.meta.url)) },
]

/** Mock mode: gives each tab its own mock world (src/mock/per-tab-storage.js), before the app's code runs. */
const perTabStorage = (): Plugin => ({
  name: 'teamshelf-mock-per-tab-storage',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('<head>', `<head><script>${readFileSync(new URL('./src/mock/per-tab-storage.js', import.meta.url), 'utf8')}</script>`),
  },
})

export default defineConfig(({ mode }) => {
  const mock = mode === 'mock'
  return {
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), ...(mock ? [perTabStorage()] : [iconLookup(), authProxy()]), appVersionFile(), siteAddress()],
    resolve: {
      alias: [...(mock ? mockAliases : []), { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
    },
    // The ports are assigned in ~/Documents/DEV_PORTS.md.
    server: { port: mock ? 3012 : 3011, strictPort: true },
  }
})
