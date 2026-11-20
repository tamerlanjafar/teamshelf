import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { leastUsedColor } from '@/lib/colors'
import { neon } from '@/lib/neon'
import type { Color, Group } from '@/lib/types'
import { NONE, unwrap } from './db'

export const groupsKey = (orgId: string) => [orgId, 'groups'] as const
/** Deleting a group deletes its links, so link lists are refreshed too. */
const linksKey = (orgId: string) => [orgId, 'links'] as const

const fetchGroups = (orgId: string) => unwrap<Group[]>(neon.from('groups').select('*').eq('org_id', orgId))

export const groupsQuery = (orgId: string) => queryOptions({ queryKey: groupsKey(orgId), queryFn: () => fetchGroups(orgId) })

/** The organization's groups. Suspends until they are loaded: use it inside a <Section>. */
export const useGroups = () => useSuspenseQuery(groupsQuery(useOrg().id)).data

/** The groups, or none while they load. For the parts of a page that are always there. */
export const useGroupsIfLoaded = (): Group[] => useQuery(groupsQuery(useOrg().id)).data ?? NONE

/** The group with this name (ignoring case), created if there is none. Super admin only. */
export async function findOrCreateGroup(orgId: string, name: string): Promise<Group> {
  const wanted = name.trim()
  const groups = await fetchGroups(orgId)
  const existing = groups.find((group) => group.name.toLowerCase() === wanted.toLowerCase())
  if (existing) return existing
  const color = leastUsedColor(groups.map((group) => group.color))
  return unwrap<Group>(neon.from('groups').insert({ org_id: orgId, name: wanted, color }).select().single())
}

function useGroupsMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: groupsKey(org.id) }), queryClient.invalidateQueries({ queryKey: linksKey(org.id) })]),
  })
}

export function useUpdateGroup() {
  return useGroupsMutation(({ id, name, color }: { id: string; name: string; color: Color }) =>
    unwrap(neon.from('groups').update({ name: name.trim(), color }).eq('id', id)),
  )
}

export function useDeleteGroup() {
  return useGroupsMutation((id: string) => unwrap(neon.from('groups').delete().eq('id', id)))
}

/** The team's order of the groups, for everyone who hasn't made their own. Admins and the super admin. */
export function useSetTeamGroupOrder() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => unwrap(neon.rpc('set_group_order', { org: org.id, ids })),
    // Show the new order at once. The server's answer replaces it.
    onMutate: (ids) => {
      queryClient.setQueryData<Group[]>(groupsKey(org.id), (groups) => groups?.map((group) => ({ ...group, position: ids.includes(group.id) ? ids.indexOf(group.id) + 1 : group.position })))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupsKey(org.id) }),
  })
}
