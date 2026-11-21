import { Navigate } from '@tanstack/react-router'
import { PageSheet } from '@/components/app/page-sheet'
import { TopBar } from '@/components/app/top-bar'
import { useMe, useOrg } from '@/features/org/org-context'
import { isAdmin } from '@/lib/roles'
import { OrgForm, OrgUrl } from './org-form'

/**
 * The organization's settings, for its admins: its name and who can join. Each space has
 * its own settings, and the theme, being yours, is in the organization menu.
 */
export function SettingsPage() {
  const org = useOrg()
  const me = useMe()
  if (!isAdmin(me)) return <Navigate to="/$org" params={{ org: org.slug }} replace />
  return (
    <>
      <TopBar />
      <PageSheet title="Organization settings">
        <OrgForm />
        <OrgUrl />
      </PageSheet>
    </>
  )
}
