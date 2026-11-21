import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { watchAppVersion } from './lib/app-version'
import { queryClient } from './lib/query-client'
import './lib/theme'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

watchAppVersion()

// Mock mode only (`pnpm dev:mock`): a made-up backend in the browser, and a toolbar to open any screen
// (src/mock). The condition is false in every other build, which then leaves all of it out.
const mockPage = import.meta.env.MODE === 'mock' && (await import('./mock/start')).startMock()

if (!mockPage)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
