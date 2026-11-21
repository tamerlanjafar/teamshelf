import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon, sendSignInLink } from '@/lib/neon'
import type { CardSizes, Color, Space, SpaceMember, SpaceRole, SpaceVisibility } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'

const spacesKey = (orgId: string) => [orgId, 'spaces'] as const
const spaceMembersKey = (orgId: string) => [orgId, 'space-members'] as const

/** The spaces this person can see. Row-level security leaves out private spaces they aren't in. */
export const spacesQuery = (orgId: string) =>
  queryOptions({
    queryKey: spacesKey(orgId),
    queryFn: async () => {
      const spaces = await unwrap<Space[]>(neon.from('spaces').select('*').eq('org_id', orgId))
      // Listed by name, so a space is easy to find however many there are.
      return spaces.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
    },
  })

export const useSpaces = () => useSuspenseQuery(spacesQuery(useOrg().id)).data
export const useSpacesIfLoaded = (): Space[] => useQuery(spacesQuery(useOrg().id)).data ?? NONE

/** Who is in which of the spaces this person can see. */
export const spaceMembersQuery = (orgId: string) =>
  queryOptions({
    queryKey: spaceMembersKey(orgId),
    queryFn: async (): Promise<SpaceMember[]> => {
      const rows = await unwrap<SpaceMember[]>(neon.from('space_members').select('space_id, member_id, role, spaces!inner(org_id)').eq('spaces.org_id', orgId))
      return rows.map(({ space_id, member_id, role }) => ({ space_id, member_id, role }))
    },
  })

export const useSpaceMembersIfLoaded = (): SpaceMember[] => useQuery(spaceMembersQuery(useOrg().id)).data ?? NONE

/** The organization's own pages, at the same level as its spaces: no space can have these addresses. */
const RESERVED = ['requests', 'settings', 'team', 'none']

/** A short address part from a name: "Data & AI" → "data-ai". */
export function slugOf(name: string) {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 34)
      .replace(/-+$/, '') || 'space'
  return RESERVED.includes(slug) ? `${slug}-space` : slug
}

function useRefresh() {
  const org = useOrg()
  const queryClient = useQueryClient()
  // A space's members decide who sees its groups and links, so those are loaded again too.
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === org.id })
}

const friendly = (error: unknown) => (isUniqueViolation(error) ? new Error('There is already a space with that name.') : error)

/** Creates a space with its first admin: the person creating it. Admins of the organization. */
export function useCreateSpace() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ name, logo, color }: { name: string; logo: string; color: Color }) => {
      try {
        return await unwrap<Space>(neon.rpc('create_space', { org: org.id, space_name: name.trim(), space_slug: slugOf(name), space_logo: logo, space_color: color }))
      } catch (error) {
        throw friendly(error)
      }
    },
    onSettled: refresh,
  })
}

export type SpaceChanges = Partial<Pick<Space, 'name' | 'logo' | 'color' | 'visibility'>>

/** The space's admins. */
export function useUpdateSpace() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: SpaceChanges }) => {
      try {
        await unwrap(neon.from('spaces').update(changes).eq('id', id))
      } catch (error) {
        throw friendly(error)
      }
    },
    onSettled: refresh,
  })
}

/** The space's board layout, for everyone who hasn't made their own. The space's admins. Shown at once, saved behind. */
export function useSetSpaceLayout() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, layout }: { id: string; layout: string[][] }) => unwrap(neon.from('spaces').update({ layout }).eq('id', id)),
    onMutate: ({ id, layout }) => {
      const before = queryClient.getQueryData<Space[]>(spacesKey(org.id))
      queryClient.setQueryData<Space[]>(spacesKey(org.id), (spaces) => spaces?.map((space) => (space.id === id ? { ...space, layout } : space)))
      return { before }
    },
    onError: (_error, _input, context) => queryClient.setQueryData(spacesKey(org.id), context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: spacesKey(org.id) }),
  })
}

/** The space's card sizes, for everyone who hasn't resized a card themselves. The space's admins. Shown at once, saved behind. */
export function useSetSpaceCardSizes() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, sizes }: { id: string; sizes: CardSizes }) => unwrap(neon.from('spaces').update({ card_sizes: sizes }).eq('id', id)),
    onMutate: ({ id, sizes }) => {
      const before = queryClient.getQueryData<Space[]>(spacesKey(org.id))
      queryClient.setQueryData<Space[]>(spacesKey(org.id), (spaces) => spaces?.map((space) => (space.id === id ? { ...space, card_sizes: sizes } : space)))
      return { before }
    },
    onError: (_error, _input, context) => queryClient.setQueryData(spacesKey(org.id), context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: spacesKey(org.id) }),
  })
}

/** Deletes the space with every group, link and file in it. The space's admins. */
export function useDeleteSpace() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (id: string) => unwrap(neon.from('spaces').delete().eq('id', id)), onSettled: refresh })
}

/** The organization's order of its spaces. Its admins. */
export function useSetSpaceOrder() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({ mutationFn: (ids: string[]) => unwrap(neon.rpc('set_space_order', { org: org.id, ids })), onSettled: refresh })
}

/** Adds a person to a space, changes their role in it, or (role null) takes them out. The space's admins. */
export function useSetSpaceMember() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ spaceId, memberId, role, current }: { spaceId: string; memberId: string; role: SpaceRole | null; current: SpaceRole | null }) => {
      const row = neon.from('space_members')
      if (role === null) await unwrap(row.delete().eq('space_id', spaceId).eq('member_id', memberId))
      else if (current === null) await unwrap(row.insert({ space_id: spaceId, member_id: memberId, role }))
      else await unwrap(row.update({ role }).eq('space_id', spaceId).eq('member_id', memberId))
    },
    onSettled: refresh,
  })
}

/** What inviting someone to a space did: added them, invited them, or asked an admin of the organization to approve. */
export type SpaceInviteResult = 'added' | 'invited' | 'waiting'

/**
 * Invites someone to a space by email. The space's admins. Someone already in the organization is
 * added; someone new is invited to it too, at once when its email's domain is let in, otherwise
 * once an admin of the organization approves. Those invited at once get the sign-in link now.
 */
export function useInviteToSpace() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ space, email, role }: { space: Space; email: string; role: SpaceRole }): Promise<SpaceInviteResult> => {
      const address = email.trim().toLowerCase()
      const result = await unwrap<SpaceInviteResult>(neon.rpc('invite_to_space', { space: space.id, invitee_email: address, invitee_role: role }))
      if (result === 'invited') {
        try {
          await sendSignInLink(address, `/${org.slug}/${space.slug}`)
        } catch {
          throw new Error(`${address} was invited, but the email could not be sent. Try again in a minute.`)
        }
      }
      return result
    },
    onSettled: refresh,
  })
}

export const visibilityLabel: Record<SpaceVisibility, string> = { org: 'Everyone in the organization', private: 'Only its members' }
