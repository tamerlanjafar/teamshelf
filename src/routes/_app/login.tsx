import { createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { LoginIntent } from '@/features/auth/login-page'
import { SignInScreen } from '@/features/auth/sign-in-screen'
import { pageHead } from '@/lib/site'

interface LoginSearch {
  /** Where to go after signing in. */
  redirect?: string
  /**
   * Neon Auth adds this when a sign-in link that no longer works sends the person back here
   * (see sendSignInLink). It never stays in the address: see Login.
   */
  error?: string
  /**
   * Signing in from the Organizations page, next to the organizations already signed in.
   * "create" is the older address of /signup, and goes there.
   */
  intent?: LoginIntent
  /** Set on the address the email's link comes back to (see sendSignInLink): the page waits for its session. */
  via?: 'link'
}

export const Route = createFileRoute('/_app/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    // "add" is the older address of signing in to another organization.
    intent: search.intent === 'create' ? 'create' : search.intent === 'join' || search.add ? 'join' : undefined,
    via: search.via === 'link' ? 'link' : undefined,
  }),
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
  const search = Route.useSearch()
  const { redirect: back, intent, via, error } = search
  const navigate = useNavigate()
  const linkExpired = useRouterState({ select: (state) => state.location.state.linkExpired === true }) || !!error
  // Fixing the address happens once the page runs, in the browser: this page is drawn at build
  // time, without knowing the address it is opened at.
  useEffect(() => {
    // Creating an organization has its own address now.
    if (intent === 'create') void navigate({ to: '/signup', replace: true })
    // A failed link's error leaves the address. The page still says what happened, from the
    // history entry, which a reload keeps and the address doesn't show.
    else if (error) void navigate({ to: '/login', search: { ...search, error: undefined }, state: { linkExpired: true }, replace: true })
  }, [intent, error, navigate, search])
  return <SignInScreen intent={intent} back={back} fromLink={via === 'link'} linkExpired={linkExpired} />
}
