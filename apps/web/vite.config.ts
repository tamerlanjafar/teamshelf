import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { authProxyDevServer } from '@teamshelf/auth-proxy/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { MADE_UP_PDF } from './src/mock/made-up-pdf.ts'

/**
 * On Netlify, /api/icon is a function (netlify/functions/actions.mjs). This gives the dev server
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
 * Mock mode's PDFs, for the viewer's frame (src/mock/files.ts): /__mock-pdf/<name>.pdf, sent the
 * way storage sends a real one (netlify/lib/r2.mjs): as a PDF, shown in place, with its name.
 * Only a name ending in .pdf is answered.
 */
const mockPdf = (): Plugin => ({
  name: 'teamshelf-mock-pdf',
  configureServer(server) {
    server.middlewares.use('/__mock-pdf', (request, response) => {
      let name = ''
      try {
        name = decodeURIComponent(new URL(request.url ?? '', 'http://localhost').pathname.slice(1))
      } catch {
        // Not an address: answered as not found, below.
      }
      if (!/^[^/\\]+\.pdf$/i.test(name)) {
        response.statusCode = 404
        response.end('not found')
        return
      }
      const filename = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
      response.setHeader('content-type', 'application/pdf')
      response.setHeader('content-disposition', `inline; filename*=UTF-8''${filename}`)
      response.setHeader('x-content-type-options', 'nosniff')
      response.end(MADE_UP_PDF)
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

/** robots.txt, with the sitemap at this site's own address. In the build, and from the dev server. */
const robotsFile = (siteUrl: string): Plugin => {
  const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
  return {
    name: 'teamshelf-robots-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_request, response) => {
        response.setHeader('content-type', 'text/plain; charset=utf-8')
        response.end(robots)
      })
    },
  }
}

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

/** .env is kept once, at the top of the repository, for every app and script. */
const ENV_DIR = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ command, mode }) => {
  const mock = mode === 'mock'
  const env = { ...loadEnv(mode, ENV_DIR, ''), ...process.env }
  // Where the site is served: set VITE_SITE_URL, or let Netlify say (URL). Used for canonical
  // links, link previews, the sitemap and robots.txt.
  const siteUrl = (env.VITE_SITE_URL || env.URL || 'http://localhost:3011').replace(/\/+$/, '')
  if (command === 'build' && !mock && !(env.VITE_NEON_AUTH_URL && env.VITE_NEON_DATA_API_URL)) {
    throw new Error('VITE_NEON_AUTH_URL and VITE_NEON_DATA_API_URL are not set. Run `pnpm cloud` (see SETUP.md), or set them where the site is built.')
  }
  return {
    envDir: ENV_DIR,
    define: {
      __SITE_URL__: JSON.stringify(siteUrl),
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
        // Only in the build: with it on, the dev server sends every page as the bare shell, so the
        // public pages wouldn't be drawn on the server in development the way they are in production.
        spa: { enabled: command === 'build', maskPath: '/organizations', prerender: { outputPath: '/_shell', crawlLinks: false } },
        // Only the pages listed: no others found on their own, none followed from links.
        prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false, autoSubfolderIndex: true, failOnError: true },
        pages: PUBLIC_PAGES.map((page) => ({ ...page, prerender: { enabled: true } })),
        sitemap: { enabled: true, host: siteUrl },
      }),
      react(),
      tailwindcss(),
      // On Netlify /api/auth/* is a function (netlify/functions/api.mjs). The dev server runs the same code.
      ...(mock ? [mockPdf()] : [iconLookup(), authProxyDevServer(env.VITE_NEON_AUTH_URL ?? '')]),
      appVersionFile(),
      robotsFile(siteUrl),
    ],
    // Fewer, larger files for the browser: the framework every page needs in one chunk, the icons in
    // one, and the app's tiny shared modules in one, instead of a dozen files of 1 or 2 KB each.
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'framework', test: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:react|react-dom|scheduler|seroval|seroval-plugins|@tanstack[\\/](?:react-router|router-core|history|store|react-store|start-[\w-]+|react-start[\w-]*))[\\/]/, priority: 30 },
              { name: 'icons', test: /node_modules[\\/].*lucide-react/, priority: 20 },
              { name: 'shared', test: /src[\\/](?:lib[\\/](?:site|colors|utils|theme|accounts|app-version)|components[\\/]app[\\/](?:brand|kbd))\.tsx?$/, priority: 10 },
            ],
          },
        },
      },
    },
    resolve: {
      alias: [...(mock ? mockAliases : []), { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
    },
    server: { port: mock ? 3012 : 3011, strictPort: true },
    // The server the build starts to draw the public pages (Start's prerender, on a free port). On
    // IPv4 itself: as "localhost" it may listen on ::1 only, and a busy build machine then misses
    // it (Node gives ::1 250ms, then tries 127.0.0.1, where nothing listens). pnpm preview is
    // scripts/preview.mjs, not this.
    preview: { host: '127.0.0.1' },
  }
})
