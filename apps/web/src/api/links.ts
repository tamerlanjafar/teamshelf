import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import type { Link, Visibility } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'
import { fileAddress, type StoredFile } from './files'
import { findOrCreateGroup, groupsKey } from './groups'
import { findIcon } from './icons'

const linksKey = (orgId: string) => [orgId, 'links'] as const
const boardKey = (orgId: string) => [...linksKey(orgId), 'board'] as const

/** The links on the boards of every space. Row-level security leaves out the ones this person may not see. */
export const boardLinksQuery = (orgId: string) =>
  queryOptions({
    queryKey: boardKey(orgId),
    queryFn: () => unwrap<Link[]>(neon.from('links').select('*').eq('org_id', orgId).eq('status', 'approved')),
  })

/** Suspends until the links are loaded: use it inside a <Section>. */
export const useBoardLinks = () => useSuspenseQuery(boardLinksQuery(useOrg().id)).data

export const useBoardLinksIfLoaded = (): Link[] => useQuery(boardLinksQuery(useOrg().id)).data ?? NONE

/** Suggestions that are waiting or were rejected: your own, plus those of the spaces you are an admin of. */
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
  spaceId: string
  /** An existing group, or the name of one that doesn't exist yet. */
  group: { id: string } | { name: string }
  /** One of the group's folders, or null for the top of the group (always, for a new group). */
  folderId: string | null
  title: string
  /** A web address. Left out for a file. */
  url?: string
  /** A file that was just uploaded. Only for a new file: a file's contents don't change. */
  file?: StoredFile
}

/** The columns a form fills in. A web address gets the icon its page declares. */
async function columns({ title, url, file }: LinkFields) {
  if (file) return { title: title.trim(), kind: 'file', url: fileAddress(file.key), file_key: file.key, file_name: file.name, file_size: file.size, file_type: file.type }
  return { title: title.trim(), ...(url ? { url, icon_url: await findIcon(url) } : {}) }
}

/** The database refuses a second link with the same name in one folder (or at the top of a group). */
async function saving<Result>(run: () => Promise<Result>, title: string, inFolder = false): Promise<Result> {
  try {
    return await run()
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(`${inFolder ? 'This folder' : 'This group'} already has a link called ${title.trim()}.`)
    throw error
  }
}

/**
 * Adds a link or a file. With `publishFor` (an admin of the space) it goes straight to the board.
 * Without it, it waits for review, and a new group is only created on approval.
 */
export function useAddLink() {
  return useLinksMutation(({ fields, publishFor }: { fields: LinkFields; publishFor?: Audience }, orgId) =>
    saving(async () => {
      const { group, spaceId } = fields
      const base = { org_id: orgId, space_id: spaceId, ...(await columns(fields)) }

      if (!publishFor) {
        const place = 'id' in group ? { group_id: group.id, folder_id: fields.folderId } : { proposed_group: group.name.trim() }
        await unwrap(neon.from('links').insert({ ...base, ...place }))
        return
      }

      const group_id = 'id' in group ? group.id : (await findOrCreateGroup(orgId, spaceId, group.name)).id
      const folder_id = 'id' in group ? fields.folderId : null
      const published = { status: 'approved', visibility: publishFor.visibility, reviewed_at: new Date().toISOString() }
      const created = await unwrap<{ id: string }>(neon.from('links').insert({ ...base, ...published, group_id, folder_id }).select('id').single())
      await setAccess(created.id, publishFor)
    }, fields.title, Boolean(fields.folderId)),
  )
}

/** The space's admins. */
export function useUpdateLink() {
  return useLinksMutation(({ id, fields, audience }: { id: string; fields: LinkFields; audience: Audience }, orgId) =>
    saving(async () => {
      const group_id = 'id' in fields.group ? fields.group.id : (await findOrCreateGroup(orgId, fields.spaceId, fields.group.name)).id
      const folder_id = 'id' in fields.group ? fields.folderId : null
      await unwrap(neon.from('links').update({ ...(await columns({ ...fields, file: undefined })), group_id, folder_id, proposed_group: null, visibility: audience.visibility }).eq('id', id))
      await setAccess(id, audience)
    }, fields.title, Boolean(fields.folderId)),
  )
}

/** Puts a suggestion on the board, creating the group it asked for if needed. The space's admins. */
export function useApproveLink() {
  return useLinksMutation((link: Link, orgId) => approve(link, orgId))
}

/** Approves several suggestions, one after another, so two that ask for the same new group share it. */
export function useApproveLinks() {
  return useLinksMutation(async (links: Link[], orgId) => {
    for (const link of links) await approve(link, orgId)
  })
}

async function approve(link: Link, orgId: string) {
  const group_id = link.group_id ?? (await findOrCreateGroup(orgId, link.space_id, link.proposed_group!)).id
  await saving(() => unwrap(
    neon
      .from('links')
      .update({ status: 'approved', group_id, proposed_group: null, reviewed_at: new Date().toISOString(), review_note: '' })
      .eq('id', link.id),
  ), link.title, Boolean(link.folder_id))
}

/** Moves links into a folder of their group, or to its top (null). The space's admins. Shown at once, put back if it fails. */
export function useMoveLinks() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ links, folderId }: { links: Link[]; folderId: string | null }) => {
      for (const link of links) await saving(() => unwrap(neon.from('links').update({ folder_id: folderId }).eq('id', link.id)), link.title, Boolean(folderId))
    },
    onMutate: ({ links, folderId }) => {
      const before = queryClient.getQueryData<Link[]>(boardKey(org.id))
      const ids = new Set(links.map((link) => link.id))
      queryClient.setQueryData<Link[]>(boardKey(org.id), (all) => all?.map((link) => (ids.has(link.id) ? { ...link, folder_id: folderId } : link)))
      return { before }
    },
    onError: (_error, _input, context) => queryClient.setQueryData(boardKey(org.id), context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: linksKey(org.id) }),
  })
}

/** The space's admins. The reason is shown to the person who suggested the link. */
export function useRejectLink() {
  return useLinksMutation(({ id, reason }: { id: string; reason: string }) =>
    unwrap(neon.from('links').update({ status: 'rejected', reviewed_at: new Date().toISOString(), review_note: reason.trim() }).eq('id', id)),
  )
}

/** The space's admins delete any of its links. Everyone else can remove their own suggestions. */
export function useDeleteLink() {
  return useLinksMutation((id: string) => unwrap(neon.from('links').delete().eq('id', id)))
}

/** The order of one group's links, for everyone who hasn't made their own. The space's admins. */
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
