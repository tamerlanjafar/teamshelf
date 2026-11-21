// Sign-in and the report, from Neon. Demo mode swaps this file for demo.ts (vite.config.ts).

import { createClient } from '@neondatabase/neon-js'
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters'
import type { ReportAnswer, Session } from '@/report'

// Sign-in goes through this site (/api/auth, netlify/functions/auth.mjs), so its cookie is this site's own.
const neon = createClient({
  auth: { url: `${window.location.origin}/api/auth/admin`, adapter: BetterAuthReactAdapter() },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
})

export function useSession(): Session {
  const session = neon.auth.useSession()
  if (session.isPending) return { state: 'loading' }
  // Anything that isn't a session with a person in it (an error page, say) is nobody signed in.
  const email = session.data && typeof session.data === 'object' ? session.data.user?.email : undefined
  return typeof email === 'string' ? { state: 'signed-in', email } : { state: 'signed-out' }
}

/** Emails a link that signs in and comes back here. */
export async function sendSignInLink(email: string) {
  const { error } = await neon.auth.signIn.magicLink({ email: email.trim().toLowerCase(), callbackURL: `${window.location.origin}/`, errorCallbackURL: `${window.location.origin}/` })
  if (error) throw new Error(error.message ?? 'The email could not be sent.')
}

export async function signOut() {
  await neon.auth.signOut()
  window.location.assign('/')
}

/** The database decides who gets the report: it answers "not allowed" to everyone else. */
export async function fetchReport(): Promise<ReportAnswer> {
  const { data, error } = await neon.rpc('back_office_report')
  if (error) throw new Error(error.message)
  return data as ReportAnswer
}
