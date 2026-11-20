import { PageSheet } from '@/components/app/page-sheet'
import { TopBar } from '@/components/app/top-bar'
import { useMe, useOrg } from '@/features/org/org-context'
import { isSuperAdmin } from '@/lib/roles'
import { OrgForm } from './org-form'
import { ThemePicker } from './theme-picker'

/**
 * Settings. Everyone has their own (how Linkboard looks). The super admin also finds the
 * organization's settings here: its name and who can join. Each space has its own settings.
 */
export function SettingsPage() {
  const org = useOrg()
  const me = useMe()
  return (
    <>
      <TopBar />
      <PageSheet title="Settings" lead={isSuperAdmin(me) ? `Yours, and those of ${org.name}.` : undefined}>
        <ThemePicker />
        {isSuperAdmin(me) && <OrgForm />}
      </PageSheet>
    </>
  )
}
