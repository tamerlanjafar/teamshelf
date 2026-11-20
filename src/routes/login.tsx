import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { LoginPage } from '@/features/auth/login-page'
import { Splash } from '@/features/auth/screens'
import { neon, safePath } from '@/lib/neon'

interface LoginSearch {
  /** Where to go after signing in. */
  redirect?: string
  /** Set when a sign-in link that no longer works sends the person back here. */
  error?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: Login,
})

function Login() {
  const session = neon.auth.useSession()
  const { error, redirect } = Route.useSearch()
  const returnPath = safePath(redirect)

  if (session.isPending) return <Splash />
  if (session.data) return <GoTo path={returnPath} />
  return <LoginPage linkError={error} returnPath={returnPath} />
}

/** Goes to a path of this app that is only known as text, such as the one to return to after signing in. */
function GoTo({ path }: { path: string }) {
  const router = useRouter()
  useEffect(() => {
    router.history.replace(path)
  }, [router, path])
  return <Splash />
}
