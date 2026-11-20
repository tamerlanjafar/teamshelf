import { QueryClient } from '@tanstack/react-query'
import { DataError } from '@/api/db'

/**
 * The database says 28000 when a request arrived without the person's identity in place, which
 * happens for a moment when it wakes from sleep. Such a request is asked again, a few times,
 * instead of showing an empty board.
 */
const notReady = (error: unknown) => error instanceof DataError && error.code === '28000'

/** The app's one cache of what it loaded. */
export const queryClient = new QueryClient({
  defaultOptions: {
    // Links change rarely: show what we have, and check again when the tab is looked at.
    queries: {
      staleTime: 30_000,
      retry: (failures, error) => (notReady(error) ? failures < 8 : failures < 1),
      retryDelay: (failures, error) => (notReady(error) ? 400 * (failures + 1) : 1000),
    },
  },
})
