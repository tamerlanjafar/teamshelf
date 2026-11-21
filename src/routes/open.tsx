import { createFileRoute } from '@tanstack/react-router'
import { privateHead } from '@/lib/site'
import { ScreenBoundary } from '@/components/app/section'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { HomeRedirect } from '@/features/org/orgs-page'
import { errorMessage } from '@/lib/errors'

/** "Open Teamshelf" on the front page: straight into your organization, or your organizations. */
export const Route = createFileRoute('/open')({ ssr: false, head: () => privateHead(), component: Open })

function Open() {
  return (
    <RequireSession>
      <ScreenBoundary loading={<Splash />} failed={(error, retry) => <LoadFailed message={errorMessage(error)} onRetry={retry} />}>
        <HomeRedirect />
      </ScreenBoundary>
    </RequireSession>
  )
}
