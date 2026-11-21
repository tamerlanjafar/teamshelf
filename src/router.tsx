import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

/**
 * The router. The public pages (/, /login, /signup) are drawn at build time into HTML (see
 * PUBLIC_PAGES in vite.config.ts). The app's own pages say `ssr: false`: they are drawn in the
 * browser only, from the shared shell (_shell.html).
 */
export function getRouter() {
  return createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
