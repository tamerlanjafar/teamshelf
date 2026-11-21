import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { crossTo, moveOrgSession } from '@/lib/accounts'
import { neon, useSession } from '@/lib/neon'
import type { Member, Org, OrgSummary } from '@/lib/types'
import { isUniqueViolation, unwrap } from './db'

// What follows depends on who is signed in, not on an organization: it is cached under the
// account's id, so one account never sees what was loaded for another.
const ACCOUNT = ['account'] as const
const myOrgsKey = (userId: string) => [...ACCOUNT, userId, 'orgs'] as const
const orgAccessKey = (userId: string, slug: string) => [...ACCOUNT, userId, 'org-access', slug] as const

/** The id of the signed-in account. These hooks are only used behind sign-in. */
const useUserId = () => useSession().data?.user.id ?? 'signed-out'

/**
 * Right after a first sign-in the database may not know the account yet. It then answers
 * "not ready" instead of guessing, and the question is asked again a moment later.
 */
class AccountNotReady extends Error {
  constructor() {
    super("Your account isn't ready yet. Try again in a moment.")
  }
}

async function whenReady<Answer>(request: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<Answer> {
  const answer = await unwrap<{ ready: boolean } & Answer>(request as never)
  if (!answer.ready) throw new AccountNotReady()
  return answer
}

const waitForAccount = {
  retry: (failures: number, error: Error) => (error instanceof AccountNotReady ? failures < 8 : failures < 1),
  retryDelay: (_failures: number, error: Error) => (error instanceof AccountNotReady ? 500 : 1000),
}

export interface MyOrgs {
  /** The organizations this person is in. */
  orgs: (OrgSummary & { role: NonNullable<OrgSummary['role']> })[]
  /** Organizations they can join without an invitation, because of their email's domain. */
  joinable: OrgSummary[]
  /** Whether this person may create organizations. The database decides (the org_creators table). */
  can_create: boolean
}

/** Also accepts the invitations that were sent to this person's email. */
export const myOrgsQuery = (userId: string) => queryOptions({ queryKey: myOrgsKey(userId), queryFn: () => whenReady<MyOrgs>(neon.rpc('my_orgs')), ...waitForAccount })

/** Suspends until the list is loaded. */
export const useMyOrgs = () => useSuspenseQuery(myOrgsQuery(useUserId())).data

/** The organizations this person is in, or none while the list loads. */
export const useMyOrgsIfLoaded = () => useQuery(myOrgsQuery(useUserId())).data?.orgs ?? []

/** What opening an organization's address gives: the membership, an offer to join, or nothing. */
export type OrgAccess = { org: Org; member: Member; can_join: false } | { org: Pick<Org, 'slug' | 'name'>; member: null; can_join: true } | null

/** Suspends until it is known what this person may do with the organization at this address. */
export function useOrgAccess(slug: string) {
  return useSuspenseQuery({
    queryKey: orgAccessKey(useUserId(), slug),
    staleTime: 5 * 60_000,
    queryFn: async () => (await whenReady<{ access: OrgAccess }>(neon.rpc('open_org', { org_slug: slug }))).access,
    ...waitForAccount,
  }).data
}

/** After joining, creating or changing an organization: load again what the account can open. */
function useRefreshAccount() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ACCOUNT })
}

export function useJoinOrg() {
  const refreshAccount = useRefreshAccount()
  return useMutation({
    mutationFn: (slug: string) => unwrap<Member>(neon.rpc('join_org', { org_slug: slug })),
    onSuccess: refreshAccount,
  })
}

export function useCreateOrg() {
  const refreshAccount = useRefreshAccount()
  return useMutation({
    mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
      try {
        return await unwrap<Org>(neon.rpc('create_org', { org_name: name, org_slug: slug }))
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('That address is taken. Try another one.')
        throw error
      }
    },
    onSuccess: refreshAccount,
  })
}

/** Admins of the organization. */
export function useUpdateOrg() {
  const refreshAccount = useRefreshAccount()
  return useMutation({
    mutationFn: ({ org, changes }: { org: Org; changes: Partial<Pick<Org, 'name' | 'allowed_domains'>> }) =>
      unwrap(neon.from('orgs').update(changes).eq('id', org.id)),
    onSuccess: refreshAccount,
  })
}

/**
 * Changes the organization's address, then opens its settings at the new one. Admins of the
 * organization. Sessions are kept per address, so this one moves with it. Old links stop working.
 */
export function useChangeOrgSlug() {
  return useMutation({
    mutationFn: async ({ org, slug }: { org: Org; slug: string }) => {
      try {
        await unwrap(neon.from('orgs').update({ slug }).eq('id', org.id))
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('That URL is taken. Try another one.')
        throw error
      }
      await moveOrgSession(org.slug, slug)
      crossTo(`/${slug}/settings`)
    },
  })
}
