import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/errors'
import { isEmail, sendSignInLink } from '@/lib/neon'
import { AuthCard } from './screens'
import { useCountdown } from './use-countdown'

/**
 * Sign-in is by a link sent to your email. There are no passwords, and one sign-in covers
 * every organization you are in. The link comes back to `returnPath`.
 */
export function LoginPage({ linkError, returnPath }: { linkError?: string; returnPath: string }) {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const send = useMutation({ mutationFn: (address: string) => sendSignInLink(address, returnPath) })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isEmail(email)) {
      setInvalid(true)
      return
    }
    send.mutate(email)
  }

  if (send.isSuccess) return <CheckEmail email={email.trim().toLowerCase()} returnPath={returnPath} onChangeEmail={() => send.reset()} />

  const error = invalid ? 'Enter a valid email address.' : send.isError ? errorMessage(send.error) : linkError ? 'That link has expired. Sign in again to get a new one.' : undefined

  return (
    <AuthCard title="Welcome to Linkboard" description="Sign in to your account">
      <form onSubmit={submit} noValidate>
        <FieldGroup className="gap-6">
          <Field className="gap-1.5" data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email" className="text-muted-foreground text-sm font-normal">
              Email*
            </FieldLabel>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@company.com"
              value={email}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setEmail(event.target.value)
                setInvalid(false)
              }}
              className="h-10 shadow-xs"
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Field className="gap-4">
            <Button type="submit" size="lg" className="h-10 rounded-lg" disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Sign in'}
            </Button>
            <FieldDescription className="text-center text-sm">We'll email you a sign-in link.</FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}

/** How long to wait before the link can be sent again, so impatient clicks don't pile up emails. */
const RESEND_AFTER_SECONDS = 30

/** After the link was sent: where it went (with a way to correct the address), and sending it again. */
function CheckEmail({ email, returnPath, onChangeEmail }: { email: string; returnPath: string; onChangeEmail: () => void }) {
  const resend = useMutation({ mutationFn: () => sendSignInLink(email, returnPath) })
  const { left, restart } = useCountdown(RESEND_AFTER_SECONDS)

  return (
    <AuthCard
      icon={
        <span className="bg-primary/10 text-primary mx-auto grid size-14 place-items-center rounded-full">
          <MailCheck className="size-6" strokeWidth={1.8} />
        </span>
      }
      title="Check your email"
      description="We sent you a sign-in link. It expires in 30 minutes."
    >
      <>
        <div className="bg-muted flex h-11 items-center gap-3 rounded-lg pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{email}</span>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary h-8 rounded-md px-2.5 text-sm" onClick={onChangeEmail}>
            Change
          </Button>
        </div>
        <Button variant="outline" size="lg" className="h-11 rounded-lg tabular-nums" disabled={left > 0 || resend.isPending} onClick={() => resend.mutate(undefined, { onSuccess: restart })}>
          {resend.isPending ? 'Sending…' : left > 0 ? `Resend in ${left}s` : 'Resend email'}
        </Button>
        {resend.isError && <p className="text-destructive m-0 text-center text-sm">{errorMessage(resend.error)}</p>}
      </>
    </AuthCard>
  )
}
