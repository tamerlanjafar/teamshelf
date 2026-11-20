import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useMe, useOrg } from '@/features/org/org-context'
import { TeamPage } from '@/features/team/team-page'
import { isAdmin } from '@/lib/roles'

export const Route = createFileRoute('/$org/team')({ component: Team })

function Team() {
  const me = useMe()
  const org = useOrg()
  if (!isAdmin(me)) return <Navigate to="/$org" params={{ org: org.slug }} search={{}} replace />
  return <TeamPage />
}
