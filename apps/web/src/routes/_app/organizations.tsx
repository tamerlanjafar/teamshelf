import { createFileRoute } from '@tanstack/react-router'
import { privateHead } from '@/lib/site'
import { ScreenBoundary } from '@/components/app/section'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { OrgsPage } from '@/features/org/orgs-page'
import { errorMessage } from '@/lib/errors'

export const Route = createFileRoute('/_app/organizations')({ ssr: false, head: () => privateHead('Your organizations · Teamshelf'), component: Organizations })

function Organizations() {
  return (
    <RequireSession>
      <ScreenBoundary loading={<Splash />} failed={(error, retry) => <LoadFailed message={errorMessage(error)} onRetry={retry} />}>
        <OrgsPage />
      </ScreenBoundary>
    </RequireSession>
  )
}
