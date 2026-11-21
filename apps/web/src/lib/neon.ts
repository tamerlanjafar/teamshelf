import { createClient } from '@neondatabase/neon-js'
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters'
import { ACTIVE_SLOT, authUrl, NEW_SLOT } from './accounts'
import { safePath } from './safe-path'

export { safePath }

/**
 * One client for both sign-in (Neon Auth) and data (Neon Data API, guarded by row-level security).
 * Sign-in goes through this site, with the session of the organization this page opened
 * (src/lib/accounts.ts), so several accounts can be signed in at once.
 */
export const neon = createClient({
  auth: {
    url: authUrl(),
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
})

/**
 * Who is signed in on this page, or nobody. Use this, not `neon.auth.useSession()` itself: an
 * answer that isn't a session (an error page from whatever serves /api/auth, say) counts as
 * nobody signed in.
 */
export function useSession() {
  const session = neon.auth.useSession()
  const data = session.data && typeof session.data === 'object' && typeof session.data.user?.id === 'string' ? session.data : null
  return { ...session, data }
}

let signInClient: typeof neon | undefined

/**
 * Sign-in links are sent with the session a sign-in starts with (src/lib/accounts.ts), whichever
 * session this page uses: the link signs that session in, never an organization's. So an
 * organization's page can show the sign-in form (from the Organizations page) without loading
 * again. Made the first time it is needed.
 */
const signInAuth = () =>
  ACTIVE_SLOT === NEW_SLOT
    ? neon.auth
    : (signInClient ??= createClient({ auth: { url: authUrl(NEW_SLOT), adapter: BetterAuthReactAdapter() }, dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL } })).auth

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())


/**
 * Emails a sign-in link that comes back to `returnPath`. One sign-in covers every organization
 * the person is in. The same email is the invitation for someone who has never signed in.
 *
 * The link first comes back to /login, which sets the new session up for the account's
 * organizations (it starts out not tied to any), then goes on to `returnPath`.
 */
export async function sendSignInLink(email: string, returnPath = '/') {
  const { error } = await signInAuth().signIn.magicLink({
    email: email.trim().toLowerCase(),
    callbackURL: `${window.location.origin}/login?via=link&redirect=${encodeURIComponent(safePath(returnPath))}`,
    errorCallbackURL: `${window.location.origin}/login`,
  })
  if (error) throw new Error(error.message ?? 'The email could not be sent.')
}
