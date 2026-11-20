import { useNavigate } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { neon } from '@/lib/neon'
import { Splash } from './screens'

/** Draws its children for someone who is signed in. Everyone else goes to sign in, and comes back here after. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = neon.auth.useSession()
  const navigate = useNavigate()
  const signedOut = !session.isPending && !session.data

  // Done once, from an effect: redirecting while rendering would start over on every render.
  useEffect(() => {
    if (signedOut) navigate({ to: '/login', search: { redirect: window.location.pathname + window.location.search }, replace: true })
  }, [signedOut, navigate])

  if (session.isPending || signedOut) return <Splash />
  return children
}
