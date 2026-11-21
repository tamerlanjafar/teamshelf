// The sign-in proxy for a Vite dev server: /api/auth/* answered by the same code the deployed
// site runs as a function (index.mjs).

import { handleAuthProxy } from './index.mjs'

/** A Vite plugin. `neonAuthUrl` is read when a request comes, so .env may be loaded after the plugin is made. */
export const authProxyDevServer = (neonAuthUrl) => ({
  name: 'teamshelf-auth-proxy',
  configureServer(server) {
    server.middlewares.use('/api/auth', async (incoming, outgoing) => {
      const chunks = []
      for await (const chunk of incoming) chunks.push(chunk)
      const headers = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) if (typeof value === 'string') headers.set(name, value)
      const method = incoming.method ?? 'GET'
      // Connect strips the mount path from url; originalUrl keeps it.
      const path = incoming.originalUrl ?? incoming.url ?? ''
      const request = new Request(`http://${incoming.headers.host}${path}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) })
      const response = await handleAuthProxy(request, typeof neonAuthUrl === 'function' ? neonAuthUrl() : neonAuthUrl)
      outgoing.statusCode = response.status
      response.headers.forEach((value, name) => {
        if (name !== 'set-cookie') outgoing.setHeader(name, value)
      })
      outgoing.setHeader('set-cookie', response.headers.getSetCookie())
      outgoing.end(Buffer.from(await response.arrayBuffer()))
    })
  },
})
