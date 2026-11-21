import { errorMessage } from '@/lib/errors'
import { privateHead } from '@/lib/site'
import { createFileRoute } from '@tanstack/react-router'
import { ScreenBoundary } from '@/components/app/section'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { CreateOrgPage } from '@/features/org/create-org-page'

export const Route = createFileRoute('/new')({ ssr: false, head: () => privateHead('New organization · Teamshelf'), component: NewOrg })

function NewOrg() {
  return (
    <RequireSession>
      <ScreenBoundary loading={<Splash />} failed={(error, retry) => <LoadFailed message={errorMessage(error)} onRetry={retry} />}>
        <CreateOrgPage />
      </ScreenBoundary>
    </RequireSession>
  )
}
