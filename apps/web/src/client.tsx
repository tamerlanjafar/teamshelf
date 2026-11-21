import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'

// Mock mode only (`pnpm dev:mock`): a made-up backend in the browser, and a toolbar to open any
// screen (src/mock). The condition is false in every other build, which then leaves all of it out.
const mockPage = import.meta.env.MODE === 'mock' && (await import('./mock/start')).startMock()

if (!mockPage)
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
