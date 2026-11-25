import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { leastUsedColor } from '@/lib/colors'
import { neon } from '@/lib/neon'
import type { Color, Group } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'

export const groupsKey = (orgId: string) => [orgId, 'groups'] as const
/** Deleting a group deletes its links and folders, so those lists are refreshed too. */
const linksKey = (orgId: string) => [orgId, 'links'] as const
const foldersKey = (orgId: string) => [orgId, 'folders'] as const

/** The groups of every space this person can see. Pages pick the open space's. */
const fetchGroups = (orgId: string) => unwrap<Group[]>(neon.from('groups').select('*').eq('org_id', orgId))

export const groupsQuery = (orgId: string) => queryOptions({ queryKey: groupsKey(orgId), queryFn: () => fetchGroups(orgId) })

/** Suspends until they are loaded: use it inside a <Section>. */
export const useGroups = () => useSuspenseQuery(groupsQuery(useOrg().id)).data

/** The groups, or none while they load. For the parts of a page that are always there. */
export const useGroupsIfLoaded = (): Group[] => useQuery(groupsQuery(useOrg().id)).data ?? NONE

export const groupsOf = (groups: Group[], spaceId: string | undefined | null) => groups.filter((group) => group.space_id === spaceId)

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

async function createGroup(orgId: string, spaceId: string, name: string, color?: Color): Promise<Group> {
  const siblings = groupsOf(await fetchGroups(orgId), spaceId)
  try {
    return await unwrap<Group>(
      neon
        .from('groups')
        .insert({ org_id: orgId, space_id: spaceId, name: name.trim(), color: color ?? leastUsedColor(siblings.map((group) => group.color)) })
        .select()
        .single(),
    )
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(`There is already a group called ${name.trim()} in this space.`)
    throw error
  }
}

/** The space's group with this name (ignoring case), created if there is none. The space's admins. */
export async function findOrCreateGroup(orgId: string, spaceId: string, name: string): Promise<Group> {
  const existing = groupsOf(await fetchGroups(orgId), spaceId).find((group) => sameName(group.name, name))
  return existing ?? createGroup(orgId, spaceId, name)
}

function useGroupsMutation<Input>(run: (input: Input, orgId: string) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(input, org.id),
    onSettled: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: groupsKey(org.id) }), queryClient.invalidateQueries({ queryKey: linksKey(org.id) }), queryClient.invalidateQueries({ queryKey: foldersKey(org.id) })]),
  })
}

export function useCreateGroup() {
  return useGroupsMutation(({ spaceId, name, color }: { spaceId: string; name: string; color?: Color }, orgId) => createGroup(orgId, spaceId, name, color))
}

export function useUpdateGroup() {
  return useGroupsMutation(async ({ id, name, color }: { id: string; name: string; color: Color }) => {
    try {
      await unwrap(neon.from('groups').update({ name: name.trim(), color }).eq('id', id))
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error(`There is already a group called ${name.trim()} in this space.`)
      throw error
    }
  })
}

export function useDeleteGroup() {
  return useGroupsMutation((id: string) => unwrap(neon.from('groups').delete().eq('id', id)))
}
