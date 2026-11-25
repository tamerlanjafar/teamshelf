import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useMe, useOrg } from '@/features/org/org-context'
import { TeamPage } from '@/features/team/team-page'
import { managesTeams } from '@/lib/roles'

export const Route = createFileRoute('/_app/$org/team')({ component: Team })

function Team() {
  const me = useMe()
  const org = useOrg()
  // Admins of the organization, and the people they let manage teams (who only see the people).
  if (!managesTeams(me)) return <Navigate to="/$org" params={{ org: org.slug }} replace />
  return <TeamPage />
}
