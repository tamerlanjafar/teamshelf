import { useQuery } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { myOrgsQuery } from '@/api/orgs'
import { ACTIVE_SLOT, crossTo, rememberAccount } from '@/lib/accounts'
import { neon } from '@/lib/neon'
import { Splash } from './screens'

/** Draws its children for someone who is signed in. Everyone else goes to sign in, and comes back here after. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = neon.auth.useSession()
  const signedOut = !session.isPending && !session.data

  // Done once, from an effect: redirecting while rendering would start over on every render.
  // Signing in uses its own session (src/lib/accounts.ts), so the page loads again.
  useEffect(() => {
    if (signedOut) crossTo(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }, [signedOut])

  if (session.isPending || signedOut) return <Splash />
  return (
    <>
      <KeepAccount user={session.data!.user} />
      {children}
    </>
  )
}

/**
 * Keeps this browser's record of the signed-in account up to date: its organizations, and its
 * session kept for each of them (one it just joined or created, or was invited to).
 */
function KeepAccount({ user }: { user: { id: string; email: string; name?: string | null } }) {
  const orgs = useQuery(myOrgsQuery(user.id)).data?.orgs
  useEffect(() => {
    if (orgs) rememberAccount(ACTIVE_SLOT, user, orgs).catch(() => {})
  }, [user, orgs])
  return null
}
