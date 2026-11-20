import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ScreenBoundary } from '@/components/app/section'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { BoardSkeleton } from '@/features/board/board-page'
import { hasStarted, OrgGate } from '@/features/org/org-gate'
import { errorMessage } from '@/lib/errors'

/** Everything of one organization lives under its address: /<org>/… */
export const Route = createFileRoute('/$org')({ component: OrgLayout })

function OrgLayout() {
  const { org } = Route.useParams()
  return (
    <RequireSession>
      <ScreenBoundary
        // The splash screen when the app opens. A page-shaped skeleton when switching organizations later.
        loading={hasStarted() ? <OrgSkeleton /> : <Splash />}
        failed={(error, retry) => <LoadFailed message={errorMessage(error)} onRetry={retry} />}
      >
        {/* The key gives each organization its own state when switching between them. */}
        <OrgGate key={org} slug={org}>
          <Outlet />
        </OrgGate>
      </ScreenBoundary>
    </RequireSession>
  )
}

function OrgSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5" aria-hidden="true">
        <span className="bg-ink/8 h-11 w-40 animate-pulse rounded-xl" />
        <span className="bg-ink/6 h-11 flex-1 animate-pulse rounded-xl" />
        <span className="bg-ink/8 h-11 w-28 animate-pulse rounded-xl" />
      </div>
      <div className="px-5">
        <BoardSkeleton />
      </div>
    </>
  )
}
