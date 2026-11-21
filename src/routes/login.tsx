import { createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import type { LoginIntent } from '@/features/auth/login-page'
import { SignInScreen } from '@/features/auth/sign-in-screen'
import { pageHead } from '@/lib/site'

interface LoginSearch {
  /** Where to go after signing in. */
  redirect?: string
  /**
   * Neon Auth adds this when a sign-in link that no longer works sends the person back here
   * (see sendSignInLink). It never stays in the address: see beforeLoad.
   */
  error?: string
  /**
   * Signing in from the Organizations page, next to the organizations already signed in.
   * "create" is the older address of /signup, and goes there.
   */
  intent?: LoginIntent
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    // "add" is the older address of signing in to another organization.
    intent: search.intent === 'create' ? 'create' : search.intent === 'join' || search.add ? 'join' : undefined,
  }),
  beforeLoad: ({ search }) => {
    // Creating an organization has its own address now.
    if (search.intent === 'create') throw redirect({ to: '/signup', replace: true })
    // A failed link's error leaves the address at once. The page still says what happened, from
    // the history entry (which a reload keeps, and the address doesn't show).
    if (search.error) throw redirect({ to: '/login', search: { ...search, error: undefined }, state: { linkExpired: true }, replace: true })
  },
  head: () =>
    pageHead({
      path: '/login',
      title: 'Sign in · Teamshelf',
      description: "Sign in to Teamshelf with a link sent to your email. No passwords. Open your team's links and files, in one place.",
    }),
  component: Login,
})

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** The sign-in link someone opened had expired, or was used already. */
    linkExpired?: boolean
  }
}

function Login() {
  const { redirect: back, intent } = Route.useSearch()
  const linkExpired = useRouterState({ select: (state) => state.location.state.linkExpired === true })
  return <SignInScreen intent={intent === 'create' ? undefined : intent} back={back} linkExpired={linkExpired} />
}
