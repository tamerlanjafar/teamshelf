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
  name: 'linkboard-icon-lookup',
  configureServer(server) {
    server.middlewares.use('/api/icon', async (request, response) => {
      const { findIcon } = await import('./netlify/lib/icon-lookup.mjs')
      const address = new URL(request.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ icon: await findIcon(address) }))
    })
  },
})

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), iconLookup()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The port is assigned in ~/Documents/DEV_PORTS.md.
  server: { port: 3011, strictPort: true },
})
