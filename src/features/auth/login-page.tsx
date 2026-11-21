import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ACTIVE_SLOT, crossTo, NEW_SLOT, setLastSlot, slotsOfEmail } from '@/lib/accounts'
import { errorMessage } from '@/lib/errors'
import { isEmail, sendSignInLink } from '@/lib/neon'
import { AUTH_BUTTON, AUTH_INPUT, AUTH_SECONDARY, AuthCard, Strong } from './screens'
import { useCountdown } from './use-countdown'

/**
 * Why someone signs in from the Organizations page: to sign in to an organization with the email
 * they use there, or to give the email that will own an organization they create.
 */
export type LoginIntent = 'join' | 'create'

const SIGN_IN = { title: 'Welcome to Teamshelf', description: "Enter your email and we'll send you a link to sign in.", button: 'Sign in' }

/** Signing in to another organization is the same sign-in, with a way back. Creating one asks for its owner. */
const WORDING: Record<LoginIntent | 'first', { title: string; description: string; button: string }> = {
  first: SIGN_IN,
  join: SIGN_IN,
  create: { title: 'Create an organization', description: "Enter your email to get started.", button: 'Continue' },
}

// Whether an email may create organizations is only known once it is signed in (the list is
// readable by signed-in people only). So the create page sends an email that may not back here,
// with the email kept in this tab for one visit, and this form says why under the field.
const CREATE_DENIED = 'teamshelf:create-denied'

/** From the create page: back to the email step, saying this email can't create organizations. */
export function backToCreateDenied(email: string) {
  try {
    sessionStorage.setItem(CREATE_DENIED, email)
  } catch {
    // Without storage the form comes back without the message.
  }
  crossTo('/signup')
}

function readCreateDenied() {
  try {
    return sessionStorage.getItem(CREATE_DENIED)
  } catch {
    return null
  }
}

/**
 * Sign-in is by a link sent to your email. There are no passwords, and one sign-in covers
 * every organization the email is in. The link comes back to `returnPath`. With an `intent`, this
 * signs in next to the organizations already signed in, whatever their emails.
 */
export function LoginPage({ linkExpired = false, returnPath, intent }: { linkExpired?: boolean; returnPath: string; intent?: LoginIntent }) {
  // The email the create page sent back, if it did: filled in, with the reason under it.
  // Read once the page runs (the build-time page has no tab to read from), then cleared.
  const [denied, setDenied] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  useEffect(() => {
    const kept = intent === 'create' ? readCreateDenied() : null
    if (kept) {
      // From this tab's storage, which only exists once the page runs (not at build time).
      // oxlint-disable-next-line react/set-state-in-effect
      setDenied(kept)
      setEmail(kept)
    }
    try {
      sessionStorage.removeItem(CREATE_DENIED)
    } catch {
      // Nothing to clear.
    }
  }, [intent])
  const [invalid, setInvalid] = useState(false)
  const navigate = useNavigate()
  // Opened from the Organizations page, this page still uses that page's session: back there
  // within the page, its list still loaded. Opened by itself, the list needs its session: load it.
  const inOrgSession = ACTIVE_SLOT !== NEW_SLOT
  const backToOrgs = () => (inOrgSession ? void navigate({ to: '/organizations' }) : crossTo('/organizations'))
  const send = useMutation({ mutationFn: (address: string) => sendSignInLink(address, returnPath) })
  const wording = WORDING[intent ?? 'first']

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isEmail(email)) {
      setInvalid(true)
      return
    }
    // An email already signed in on this browser needs no link: go on with its session.
    const slots = intent ? slotsOfEmail(email) : []
    if (slots.length > 0) {
      setLastSlot(slots[0])
      crossTo(intent === 'create' ? '/new' : '/organizations')
      return
    }
    send.mutate(email)
  }

  if (send.isSuccess) return <CheckEmail email={email.trim().toLowerCase()} returnPath={returnPath} onChangeEmail={() => send.reset()} />

  const deniedNow = denied !== null && email.trim().toLowerCase() === denied.toLowerCase()
  const error = invalid
    ? 'Enter a valid email address.'
    : send.isError
      ? errorMessage(send.error)
      : deniedNow
        ? 'Creating organizations is limited to approved emails for now, and this one isn\'t on the list yet.'
        : linkExpired
          ? 'That link has expired. Sign in again to get a new one.'
          : undefined

  return (
    <AuthCard title={wording.title} description={wording.description} back={intent ? { label: 'Your organizations', onClick: backToOrgs, signedInOnly: true } : undefined}>
      <form onSubmit={submit} noValidate>
        <FieldGroup className="gap-6">
          <Field className="gap-1.5" data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email" className="text-[13.5px] font-medium">
              Email
            </FieldLabel>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setEmail(event.target.value)
                setInvalid(false)
              }}
              // Enter sends the form itself: a password manager's menu on the field can keep
              // the browser's own Enter from reaching the form.
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }}
              className={AUTH_INPUT}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Field className="gap-4">
            <Button type="submit" size="lg" className={AUTH_BUTTON} disabled={send.isPending}>
              {send.isPending ? 'Sending…' : wording.button}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      {/* The other way in. Signed in already (from the Organizations page), signing in is for another organization. */}
      <p className="text-quiet m-0 mt-3 text-center text-[14px]">
        {intent === 'create' ? (
          <>
            Already use Teamshelf?{' '}
            <Link to="/login" search={inOrgSession ? { intent: 'join' } : {}} className={OTHER_WAY}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Teamshelf?{' '}
            <Link to="/signup" className={OTHER_WAY}>
              Create an organization
            </Link>
          </>
        )}
      </p>
    </AuthCard>
  )
}

const OTHER_WAY = 'text-brand font-medium underline-offset-4 hover:underline'

/** How long to wait before the link can be sent again, so impatient clicks don't pile up emails. */
const RESEND_AFTER_SECONDS = 30

/**
 * After the link was sent. The sentence says what to do, with the address it went to. Sending it
 * again is quiet: a line that counts down, then a button once the wait is over, so nothing on
 * the page looks like the main action but blocked.
 */
function CheckEmail({ email, returnPath, onChangeEmail }: { email: string; returnPath: string; onChangeEmail: () => void }) {
  const resend = useMutation({ mutationFn: () => sendSignInLink(email, returnPath) })
  const { left, restart } = useCountdown(RESEND_AFTER_SECONDS)
  const waiting = left > 0

  return (
    <AuthCard
      back={{ label: 'Use another email', onClick: onChangeEmail }}
      icon={<MailCheck strokeWidth={2} />}
      title="Check your email"
      description={
        <>
          Click the link we sent to <Strong>{email}</Strong> to sign in. It expires in 30 minutes.
        </>
      }
    >
      {waiting ? (
        <p className="text-quiet m-0 text-[14px]">
          Can't find it? Check your spam folder, or resend in{' '}
          {/* The countdown stands out from the sentence, so it reads as a timer. */}
          <span className="text-brand inline-flex min-w-[46px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_11%,transparent)] px-2 py-px text-[13px] font-semibold tabular-nums">
            0:{String(left).padStart(2, '0')}
          </span>
        </p>
      ) : (
        <p className="text-quiet m-0 text-[14px]">Can't find it? Check your spam folder, or send it again.</p>
      )}
      {!waiting && (
        <Button variant="outline" size="lg" className={AUTH_SECONDARY} disabled={resend.isPending} onClick={() => resend.mutate(undefined, { onSuccess: restart })}>
          {resend.isPending ? 'Sending…' : 'Resend email'}
        </Button>
      )}
      {resend.isError && <p className="text-destructive m-0 text-sm">{errorMessage(resend.error)}</p>}
    </AuthCard>
  )
}
