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

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), iconLookup(), appVersionFile(), siteAddress()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The port is assigned in ~/Documents/DEV_PORTS.md.
  server: { port: 3011, strictPort: true },
})
