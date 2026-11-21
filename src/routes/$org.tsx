import { createFileRoute, Outlet } from '@tanstack/react-router'
import { privateHead } from '@/lib/site'
import { ScreenBoundary } from '@/components/app/section'
import { AppShell } from '@/components/app/sidebar'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { BoardSkeleton } from '@/features/board/board-page'
import { hasStarted, OrgGate } from '@/features/org/org-gate'
import { errorMessage } from '@/lib/errors'

/** Everything of one organization lives under its address: /<org>/… */
export const Route = createFileRoute('/$org')({ ssr: false, head: () => privateHead(), component: OrgLayout })

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
          <AppShell>
            <Outlet />
          </AppShell>
        </OrgGate>
      </ScreenBoundary>
    </RequireSession>
  )
}

/** The shape of the page while an organization opens: the sidebar's column and a board. */
function OrgSkeleton() {
  return (
    <div className="md:grid md:grid-cols-[252px_minmax(0,1fr)]" aria-hidden="true">
      <div className="bg-surface border-line hidden h-dvh flex-col gap-2 border-r p-3 md:flex">
        <span className="bg-ink/8 mb-3 h-9 w-36 animate-pulse rounded-lg" />
        {[0, 1, 2, 3].map((row) => (
          <span key={row} className="bg-ink/6 h-8 animate-pulse rounded-lg" />
        ))}
        <span className="bg-ink/8 mt-auto h-12 animate-pulse rounded-xl" />
      </div>
      <div>
        <div className="flex items-center gap-3 px-5 py-3.5">
          <span className="bg-ink/8 h-10 w-40 animate-pulse rounded-lg" />
          <span className="bg-ink/6 h-10 flex-1 animate-pulse rounded-lg" />
          <span className="bg-ink/8 h-10 w-24 animate-pulse rounded-lg" />
        </div>
        <div className="px-5">
          <BoardSkeleton />
        </div>
      </div>
    </div>
  )
}
