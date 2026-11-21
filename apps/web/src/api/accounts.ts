import { useQuery } from '@tanstack/react-query'
import { ACTIVE_SLOT, type Account, crossTo, dropAccount, fetchAccount, pathAfterSignOut, rememberAccount, savedAccounts, signOutAccount, signOutEverywhere, signOutOrg } from '@/lib/accounts'
import { useSession } from '@/lib/neon'
import { useMyOrgsIfLoaded } from './orgs'

/**
 * The other accounts signed in on this browser, and their organizations. Each is asked with its
 * own session, so the list is current, and an account signed out elsewhere drops off it.
 * Shows the remembered list at once, while they are asked.
 */
export function useOtherAccounts(): Account[] {
  const me = useSession().data?.user.id
  const others = () => savedAccounts().filter((account) => account.userId !== me && account.slots.length > 0)
  return (
    useQuery({
      queryKey: ['other-accounts', me],
      enabled: Boolean(me),
      staleTime: 60_000,
      placeholderData: others,
      queryFn: async () => {
        const current = await Promise.all(
          others().map(async (account) => {
            const seen = await fetchAccount(account.slots[0]).catch(() => undefined)
            if (seen === undefined) return account // Couldn't ask: keep what we knew.
            if (seen === null) {
              await signOutAccount(account) // Its session ended: clear its cookies too.
              return null
            }
            if (seen.user.id !== account.userId) {
              dropAccount(account.userId) // Another account signed in there since.
              return null
            }
            return rememberAccount(account.slots[0], seen.user, seen.orgs)
          }),
        )
        return current.filter((account): account is Account => account !== null && account.slots.length > 0)
      },
    }).data ?? []
  )
}

/** An organization signed in on this browser, with the email it is signed in with. */
export interface SignedInOrg {
  slug: string
  name: string
  email: string
  /** Whether it uses this page's session: then opening it needs no reload. */
  here: boolean
}

/**
 * Every organization signed in on this browser: this page's account's first, then those of the
 * other emails. One list, without grouping by account.
 */
export function useSignedInOrgs(): SignedInOrg[] {
  const email = useSession().data?.user.email ?? ''
  const mine = useMyOrgsIfLoaded()
  const others = useOtherAccounts()
  return [
    ...mine.map((org) => ({ slug: org.slug, name: org.name, email, here: true })),
    ...others.flatMap((account) =>
      account.orgs.filter((org) => account.slots.includes(org.slug)).map((org) => ({ slug: org.slug, name: org.name, email: account.email, here: false })),
    ),
  ]
}

/** Signs this browser out of the organization this page is in, then goes on to the ones left, or to signing in. */
export function useSignOutOfOrg() {
  const userId = useSession().data?.user.id
  return async () => {
    await signOutOrg(ACTIVE_SLOT, userId)
    crossTo(pathAfterSignOut())
  }
}

/** Signs this browser out of every organization. */
export function useSignOutEverywhere() {
  return async () => {
    await signOutEverywhere(ACTIVE_SLOT)
    crossTo('/login')
  }
}
