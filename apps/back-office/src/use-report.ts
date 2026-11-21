import { useQuery } from '@tanstack/react-query'
import { fetchReport } from '@/backend'
import type { Report } from '@/report'

/** Right after a first sign-in the database may not know the account yet: asked again a moment later. */
class NotReady extends Error {}

/** The report, or `false` for someone who is signed in but isn't a super admin. */
export function useReportQuery() {
  return useQuery({
    queryKey: ['report'],
    queryFn: async (): Promise<Report | false> => {
      const answer = await fetchReport()
      if (!answer.ready) throw new NotReady("Your account isn't ready yet.")
      return answer.allowed ? answer : false
    },
    retry: (failures, error) => (error instanceof NotReady ? failures < 8 : failures < 1),
    retryDelay: 600,
    staleTime: 60_000,
  })
}
