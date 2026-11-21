import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { myOrgsQuery } from '@/api/orgs'
import { LoginPage } from '@/features/auth/login-page'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { crossTo, forgetNewSession, NEW_SLOT, orgOfPath, rememberAccount, setLastSlot } from '@/lib/accounts'
import type { LoginIntent } from '@/features/auth/login-page'
import { errorMessage } from '@/lib/errors'
import { neon, safePath } from '@/lib/neon'

interface LoginSearch {
  /** Where to go after signing in. */
  redirect?: string
  /**
   * Neon Auth adds this when a sign-in link that no longer works sends the person back here
   * (see sendSignInLink). It never stays in the address: see beforeLoad.
   */
  error?: string
  /**
   * Signing in from the Organizations page, next to the organizations already signed in: to log
   * in to an organization with its email, or to give an email to the organization you create.
   */
  intent?: LoginIntent
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    // "add" is the older address of signing in to another organization.
    intent: search.intent === 'join' || search.intent === 'create' ? search.intent : search.add ? 'join' : undefined,
  }),
  // A failed link's error leaves the address at once. The page still says what happened, from
  // the history entry (which a reload keeps, and the address doesn't show).
  beforeLoad: ({ search }) => {
    if (search.error) throw redirect({ to: '/login', search: { ...search, error: undefined }, state: { linkExpired: true }, replace: true })
  },
  component: Login,
})

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** The sign-in link someone opened had expired, or was used already. */
    linkExpired?: boolean
  }
}

/**
 * Signing in. This page always uses the session a sign-in starts with (src/lib/accounts.ts):
 * when the email's link comes back here, that session is there, and is set up for the account's
 * organizations before going on.
 */
function Login() {
  const session = neon.auth.useSession()
  const { redirect: back, intent } = Route.useSearch()
  const linkExpired = useRouterState({ select: (state) => state.location.state.linkExpired === true })
  const returnPath = intent === 'create' ? '/new' : safePath(back)

  if (session.isPending) return <Splash />
  if (session.data && !intent) return <FinishSignIn user={session.data.user} returnPath={returnPath} />
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
