import { createClient } from '@neondatabase/neon-js'
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters'

/** One client for both sign-in (Neon Auth) and data (Neon Data API, guarded by row-level security). */
export const neon = createClient({
  auth: {
    url: import.meta.env.VITE_NEON_AUTH_URL,
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
})

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** A path inside this app ("/caspiantech/team"), or "/" for anything else. Keeps redirects on this site. */
export const safePath = (path: string | undefined) => (path && /^\/(?!\/)/.test(path) ? path : '/')

/**
 * Emails a sign-in link that comes back to `returnPath`. One sign-in covers every organization
 * the person is in. The same email is the invitation for someone who has never signed in.
 */
export async function sendSignInLink(email: string, returnPath = '/') {
  const { error } = await neon.auth.signIn.magicLink({
    email: email.trim().toLowerCase(),
    callbackURL: window.location.origin + safePath(returnPath),
    errorCallbackURL: `${window.location.origin}/login`,
  })
  if (error) throw new Error(error.message ?? 'The email could not be sent.')
}
