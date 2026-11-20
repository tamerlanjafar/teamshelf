import { createFileRoute } from '@tanstack/react-router'
import { ScreenBoundary } from '@/components/app/section'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { HomeRedirect } from '@/features/org/orgs-page'
import { errorMessage } from '@/lib/errors'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <RequireSession>
      <ScreenBoundary loading={<Splash />} failed={(error, retry) => <LoadFailed message={errorMessage(error)} onRetry={retry} />}>
        <HomeRedirect />
      </ScreenBoundary>
    </RequireSession>
  )
}
