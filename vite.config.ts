import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { SITE_URL } from './src/lib/site.ts'

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
// so an open tab can tell that a newer deploy is live (src/lib/app-version.ts). The same for the
// whole build: TanStack Start reads this file more than once (and in more than one process), and
// a version that differed between the bundle and version.json made open tabs reload over and
// over. So it is the deploy's commit on Netlify, and otherwise one time kept in the environment.
process.env.TEAMSHELF_BUILD_ID ??= process.env.COMMIT_REF?.slice(0, 12) ?? Date.now().toString(36)
const appVersion = process.env.TEAMSHELF_BUILD_ID

const appVersionFile = (): Plugin => ({
  name: 'teamshelf-app-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: appVersion }) })
  },
})

/**
 * Mock mode (`pnpm dev:mock`, src/mock): the Neon client is swapped for one that answers from
 * made-up data in the browser, so nothing reaches Neon, R2 or the icon lookup.
 */
const mockAliases = [
  { find: /^@neondatabase\/neon-js$/, replacement: fileURLToPath(new URL('./src/mock/neon-client.ts', import.meta.url)) },
  { find: /^@neondatabase\/neon-js\/auth\/react\/adapters$/, replacement: fileURLToPath(new URL('./src/mock/neon-adapters.ts', import.meta.url)) },
]

/**
 * The pages people find on Google: drawn at build time into plain HTML (fast, and readable
 * without running the app), and listed in the sitemap. Every other page is drawn in the
 * browser, from one shared shell (_shell.html).
 */
const PUBLIC_PAGES = [
  { path: '/', sitemap: { priority: 1, changefreq: 'weekly' as const } },
  { path: '/signup', sitemap: { priority: 0.8, changefreq: 'monthly' as const } },
  { path: '/login', sitemap: { priority: 0.6, changefreq: 'monthly' as const } },
]

export default defineConfig(({ mode }) => {
  const mock = mode === 'mock'
  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      // Mock mode: gives each tab its own mock world (src/mock/per-tab-storage.js), as a script
      // the page runs before the app's code (src/routes/__root.tsx). Empty in every other build.
      __MOCK_TAB_SCRIPT__: JSON.stringify(mock ? readFileSync(new URL('./src/mock/per-tab-storage.js', import.meta.url), 'utf8') : ''),
    },
    plugins: [
      tanstackStart({
        // Mock mode starts its made-up backend before the app (src/client.tsx).
        client: { entry: 'client.tsx' },
        // The shell for every other page: drawn from an app page (not "/", which is a page of its own).
        spa: { enabled: true, maskPath: '/open', prerender: { outputPath: '/_shell', crawlLinks: false } },
        // Only the pages listed: no others found on their own, none followed from links.
        prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false, autoSubfolderIndex: true, failOnError: true },
        pages: PUBLIC_PAGES.map((page) => ({ ...page, prerender: { enabled: true } })),
        sitemap: { enabled: true, host: SITE_URL },
      }),
      react(),
      tailwindcss(),
      ...(mock ? [] : [iconLookup(), authProxy()]),
      appVersionFile(),
    ],
    resolve: {
      alias: [...(mock ? mockAliases : []), { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
    },
    // The ports are assigned in ~/Documents/DEV_PORTS.md.
    server: { port: mock ? 3012 : 3011, strictPort: true },
  }
})
