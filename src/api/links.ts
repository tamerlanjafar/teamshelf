import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import type { Link, Visibility } from '@/lib/types'
import { NONE, unwrap } from './db'
import { findOrCreateGroup, groupsKey } from './groups'

const linksKey = (orgId: string) => [orgId, 'links'] as const
const boardKey = (orgId: string) => [...linksKey(orgId), 'board'] as const

/** The links on the board. Row-level security leaves out the ones this person may not see. */
export const boardLinksQuery = (orgId: string) =>
  queryOptions({
    queryKey: boardKey(orgId),
    queryFn: () => unwrap<Link[]>(neon.from('links').select('*').eq('org_id', orgId).eq('status', 'approved')),
  })

/** Suspends until the links are loaded: use it inside a <Section>. */
export const useBoardLinks = () => useSuspenseQuery(boardLinksQuery(useOrg().id)).data

export const useBoardLinksIfLoaded = (): Link[] => useQuery(boardLinksQuery(useOrg().id)).data ?? NONE

/**
 * Suggestions that are waiting or were rejected: your own, plus the ones you review
 * (all of them for the super admin, those of their categories for a category's manager).
 */
export const requestsQuery = (orgId: string) =>
  queryOptions({
    queryKey: [...linksKey(orgId), 'requests'],
    queryFn: () => unwrap<Link[]>(neon.from('links').select('*').eq('org_id', orgId).neq('status', 'approved').order('created_at', { ascending: false })),
  })

/** Suspends until the suggestions are loaded: use it inside a <Section>. */
export const useRequests = () => useSuspenseQuery(requestsQuery(useOrg().id)).data

export const useRequestsIfLoaded = (): Link[] => useQuery(requestsQuery(useOrg().id)).data ?? NONE

/** The ids of the members who may see a link whose visibility is "members". */
export function useLinkAccess(linkId: string | undefined) {
  const org = useOrg()
  return useQuery({
    queryKey: [...linksKey(org.id), 'access', linkId],
    enabled: Boolean(linkId),
    queryFn: async () => {
      const rows = await unwrap<{ member_id: string }[]>(neon.from('link_access').select('member_id').eq('link_id', linkId!))
      return rows.map((row) => row.member_id)
    },
  })
}

function useLinksMutation<Input>(run: (input: Input, orgId: string) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(input, org.id),
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: linksKey(org.id) }), queryClient.invalidateQueries({ queryKey: groupsKey(org.id) })]),
  })
}

/** Who may see a link. `memberIds` only matters when the visibility is "members". */
export interface Audience {
  visibility: Visibility
  memberIds: string[]
}

async function setAccess(linkId: string, { visibility, memberIds }: Audience) {
  await unwrap(neon.from('link_access').delete().eq('link_id', linkId))
  if (visibility !== 'members' || memberIds.length === 0) return
  await unwrap(neon.from('link_access').insert(memberIds.map((member_id) => ({ link_id: linkId, member_id }))))
}

/** What the link form collects, for a new link and for an edited one. */
export interface LinkFields {
  /** An existing group, or the name of one that doesn't exist yet. */
  group: { id: string } | { name: string }
  title: string
  url: string
  categoryId: string | null
}

const columns = ({ title, url, categoryId }: LinkFields) => ({ title: title.trim(), url, category_id: categoryId })

/**
 * Adds a link. With `publishFor` (the super admin) it goes straight to the board.
 * Without it the link waits for review, and a new group is only created on approval.
 */
export function useAddLink() {
  return useLinksMutation(async ({ fields, publishFor }: { fields: LinkFields; publishFor?: Audience }, orgId) => {
    const { group } = fields

    if (!publishFor) {
      const place = 'id' in group ? { group_id: group.id } : { proposed_group: group.name.trim() }
      await unwrap(neon.from('links').insert({ org_id: orgId, ...columns(fields), ...place }))
      return
    }

    const group_id = 'id' in group ? group.id : (await findOrCreateGroup(orgId, group.name)).id
    const published = { status: 'approved', visibility: publishFor.visibility, reviewed_at: new Date().toISOString() }
    const created = await unwrap<{ id: string }>(
      neon.from('links').insert({ org_id: orgId, ...columns(fields), ...published, group_id }).select('id').single(),
    )
    await setAccess(created.id, publishFor)
  })
}

/** Super admin only. */
export function useUpdateLink() {
  return useLinksMutation(async ({ id, fields, audience }: { id: string; fields: LinkFields; audience: Audience }, orgId) => {
    const group_id = 'id' in fields.group ? fields.group.id : (await findOrCreateGroup(orgId, fields.group.name)).id
    await unwrap(neon.from('links').update({ ...columns(fields), group_id, proposed_group: null, visibility: audience.visibility }).eq('id', id))
    await setAccess(id, audience)
  })
}

/** Puts a suggestion on the board, creating the group it asked for if needed. Super admin only. */
export function useApproveLink() {
  return useLinksMutation(async (link: Link, orgId) => {
    const group_id = link.group_id ?? (await findOrCreateGroup(orgId, link.proposed_group!)).id
    await unwrap(
      neon
        .from('links')
        .update({ status: 'approved', group_id, proposed_group: null, reviewed_at: new Date().toISOString(), review_note: '' })
        .eq('id', link.id),
    )
  })
}

/** Super admin only. The reason is shown to the person who suggested the link. */
export function useRejectLink() {
  return useLinksMutation(({ id, reason }: { id: string; reason: string }) =>
    unwrap(neon.from('links').update({ status: 'rejected', reviewed_at: new Date().toISOString(), review_note: reason.trim() }).eq('id', id)),
  )
}

/** The super admin deletes any link. Everyone else can remove their own suggestions. */
export function useDeleteLink() {
  return useLinksMutation((id: string) => unwrap(neon.from('links').delete().eq('id', id)))
}

/** The team's order of one group's links, for everyone who hasn't made their own. Admins and the super admin. */
export function useSetTeamLinkOrder() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, ids }: { groupId: string; ids: string[] }) => unwrap(neon.rpc('set_link_order', { group_id: groupId, ids })),
    // Show the new order at once. The server's answer replaces it.
    onMutate: ({ ids }) => {
      queryClient.setQueryData<Link[]>(boardKey(org.id), (links) => links?.map((link) => ({ ...link, position: ids.includes(link.id) ? ids.indexOf(link.id) + 1 : link.position })))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKey(org.id) }),
  })
}
