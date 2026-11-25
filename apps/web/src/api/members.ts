import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon, sendSignInLink } from '@/lib/neon'
import type { Member, Role } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'

const membersKey = (orgId: string) => [orgId, 'members'] as const

export const membersQuery = (orgId: string) =>
  queryOptions({
    queryKey: membersKey(orgId),
    queryFn: () => unwrap<Member[]>(neon.from('members').select('*').eq('org_id', orgId).order('invited_at')),
  })

/** Everyone in the organization. Suspends until they are loaded: use it inside a <Section>. */
export const useMembers = () => useSuspenseQuery(membersQuery(useOrg().id)).data

/** Everyone in the organization, or nobody while that loads. */
export const useMembersIfLoaded = (): Member[] => useQuery(membersQuery(useOrg().id)).data ?? NONE

function useMembersMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersKey(org.id) }),
  })
}

/** Adds the person to the organization and emails them a sign-in link that opens it. */
export function useInviteMember() {
  const org = useOrg()
  return useMembersMutation(async ({ email, role }: { email: string; role: Role }) => {
    const address = email.trim().toLowerCase()
    try {
      await unwrap(neon.from('members').insert({ org_id: org.id, email: address, role }))
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error(`${address} is already in ${org.name}.`)
      throw error
    }
    try {
      await sendSignInLink(address, `/${org.slug}`)
    } catch {
      throw new Error(`${address} was added, but the email could not be sent. Use "Resend invite" in a minute.`)
    }
  })
}

export function useResendInvite() {
  const org = useOrg()
  return useMutation({ mutationFn: (email: string) => sendSignInLink(email, `/${org.slug}`) })
}

export function useSetMemberRole() {
  return useMembersMutation(({ id, role }: { id: string; role: Role }) =>
    unwrap(neon.from('members').update({ role }).eq('id', id)),
  )
}

/**
 * Lets in someone a space invited from outside what the organization lets in, and emails them the
 * sign-in link to it. Admins of the organization.
 */
/** Lets someone create teams and manage the ones they created, or stops it. Admins of the organization. */
export function useSetManagesTeams() {
  return useMembersMutation(({ id, manages }: { id: string; manages: boolean }) => unwrap(neon.from('members').update({ manages_teams: manages }).eq('id', id)))
}

export function useApproveMember() {
  const org = useOrg()
  return useMembersMutation(async (member: Member) => {
    await unwrap(neon.from('members').update({ approved: true }).eq('id', member.id))
    try {
      await sendSignInLink(member.email, `/${org.slug}`)
    } catch {
      throw new Error(`${member.email} was approved, but the email could not be sent. Use "Resend invite" in a minute.`)
    }
  })
}

export function useRemoveMember() {
  return useMembersMutation((id: string) => unwrap(neon.from('members').delete().eq('id', id)))
}
