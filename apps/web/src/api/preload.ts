import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { use } from 'react'
import { useMe, useOrg } from '@/features/org/org-context'
import { spaceMembersQuery, spacesQuery } from './spaces'
import { groupsQuery } from './groups'
import { boardLinksQuery, requestsQuery } from './links'
import { membersQuery } from './members'
import { myOrgsQuery } from './orgs'
import { boardPrefsQuery } from './prefs'

/** One load per member, so re-rendering while it runs doesn't start it again. */
const loads = new Map<string, Promise<unknown>>()

function loadAll(queryClient: QueryClient, orgId: string, memberId: string, userId: string) {
  // prefetchQuery never rejects: a query that fails is left for its own section to report.
  const queries = [groupsQuery(orgId), boardLinksQuery(orgId), requestsQuery(orgId), spacesQuery(orgId), spaceMembersQuery(orgId), membersQuery(orgId), boardPrefsQuery(memberId)]
  return Promise.all([...queries.map((query) => queryClient.prefetchQuery(query as never)), queryClient.prefetchQuery(myOrgsQuery(userId))])
}

/**
 * Loads everything the organization's pages show, and suspends until all of it has arrived
 * or failed. Used once, when the app starts, so the splash screen gives way to a complete page.
 */
export function usePreloadOrg() {
  const org = useOrg()
  const me = useMe()
  const queryClient = useQueryClient()
  if (!loads.has(me.id)) loads.set(me.id, loadAll(queryClient, org.id, me.id, me.user_id!))
  use(loads.get(me.id)!)
}
