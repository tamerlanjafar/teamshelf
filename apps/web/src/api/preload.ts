import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { use } from 'react'
import { useMe, useOrg } from '@/features/org/org-context'
import { spaceMembersQuery, spacesQuery } from './spaces'
import { foldersQuery } from './folders'
import { groupsQuery } from './groups'
import { boardLinksQuery, requestsQuery } from './links'
import { membersQuery } from './members'
import { myOrgsQuery } from './orgs'
import { boardPrefsQuery } from './prefs'

/** One load per member, so re-rendering while it runs doesn't start it again. */
const loads = new Map<string, Promise<unknown>>()

function loadAll(queryClient: QueryClient, orgId: string, memberId: string, userId: string) {
  // prefetchQuery never rejects: a query that fails is left for its own section to report.
  const queries = [groupsQuery(orgId), foldersQuery(orgId), boardLinksQuery(orgId), spacesQuery(orgId), spaceMembersQuery(orgId), boardPrefsQuery(memberId)]
  // Not waited for: the suggestions (the slowest to load; the sidebar's count fills in a moment
  // later) and the people of the organization (the Team page and the forms). The pages that need
  // them wait for them in their own sections.
  for (const later of [requestsQuery(orgId), membersQuery(orgId)]) void queryClient.prefetchQuery(later as never)
  return Promise.all([...queries.map((query) => queryClient.prefetchQuery(query as never)), queryClient.prefetchQuery(myOrgsQuery(userId))])
}

/**
 * Loads what the organization's board shows, and suspends until all of it has arrived or failed
 * (the rest loads alongside, see loadAll). Used once, when the app starts, so the splash screen
 * gives way to a complete board.
 */
export function usePreloadOrg() {
  const org = useOrg()
  const me = useMe()
  const queryClient = useQueryClient()
  if (!loads.has(me.id)) loads.set(me.id, loadAll(queryClient, org.id, me.id, me.user_id!))
  use(loads.get(me.id)!)
}
