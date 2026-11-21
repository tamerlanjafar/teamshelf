import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FileStorage } from '@/pages/storage'
import { Organizations } from '@/pages/organizations'
import { Overview } from '@/pages/overview'
import { Shell } from '@/shell'
import './index.css'

// Three pages inside one frame, which is also the door (shell.tsx).
const root = createRootRoute({ component: Shell })
const routes = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Overview }),
  createRoute({ getParentRoute: () => root, path: '/organizations', component: Organizations }),
  createRoute({ getParentRoute: () => root, path: '/storage', component: FileStorage }),
])
const router = createRouter({ routeTree: routes })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
