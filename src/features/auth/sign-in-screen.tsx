import { useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { myOrgsQuery } from '@/api/orgs'
import { LoginPage, type LoginIntent } from '@/features/auth/login-page'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { crossTo, forgetNewSession, NEW_SLOT, orgOfPath, rememberAccount, setLastSlot } from '@/lib/accounts'
import { errorMessage } from '@/lib/errors'
import { neon, safePath } from '@/lib/neon'

/**
 * Signing in (/login), or giving the email for a new organization (/signup). This page always
 * uses the session a sign-in starts with (src/lib/accounts.ts): when the email's link comes back
 * here, that session is there, and is set up for the account's organizations before going on.
 *
 * Drawn at build time as the form (for search engines, and so it shows at once), and that is
 * also what it shows until the page is running. Then, coming back from a sign-in link, it
 * finishes signing in.
 */
export function SignInScreen({ intent, back, linkExpired = false }: { intent?: LoginIntent; back?: string; linkExpired?: boolean }) {
  const hydrated = useHydrated()
  const session = neon.auth.useSession()
  const returnPath = intent === 'create' ? '/new' : safePath(back)

  if (hydrated) {
    // Back from a sign-in link: wait for its session rather than showing the form again.
    if (session.isPending && back) return <Splash />
    if (session.data && !intent) return <FinishSignIn user={session.data.user} returnPath={returnPath} />
  }
  return <LoginPage linkExpired={linkExpired} returnPath={returnPath} intent={intent} />
}

/**
 * Keeps the new session for each of the account's organizations, then opens the page it came
 * for, if this account can. The page loads again, to use that organization's session.
 */
function FinishSignIn({ user, returnPath }: { user: { id: string; email: string; name?: string | null }; returnPath: string }) {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { orgs, joinable } = await queryClient.fetchQuery(myOrgsQuery(user.id))
      const account = await rememberAccount(NEW_SLOT, user, orgs, true)
      if (cancelled) return
      if (account.slots.length === 0) {
        // Not in an organization yet: stay with this session to join or create one.
        setLastSlot(NEW_SLOT)
        crossTo(returnPath === '/' || orgOfPath(returnPath) ? '/organizations' : returnPath)
        return
      }
      const wanted = orgOfPath(returnPath)
      // With one organization and nothing to join, straight into it. Otherwise a choice.
      const only = account.slots.length === 1 && joinable.length === 0 ? `/${account.slots[0]}` : '/organizations'
      const target = wanted ? (account.slots.includes(wanted) ? returnPath : only) : returnPath === '/' ? only : returnPath
      setLastSlot(orgOfPath(target) ?? account.slots[0])
      await forgetNewSession()
      crossTo(target)
    })().catch((problem) => !cancelled && setFailure(problem))
    return () => {
      cancelled = true
    }
  }, [queryClient, user, returnPath, attempt])

  if (failure)
    return (
      <LoadFailed
        message={errorMessage(failure)}
        onRetry={() => {
          setFailure(null)
          setAttempt((count) => count + 1)
        }}
      />
    )
  return <Splash />
}
