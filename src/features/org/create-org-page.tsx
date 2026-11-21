import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { useCreateOrg, useMyOrgs } from '@/api/orgs'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/app/form'
import { backToCreateDenied } from '@/features/auth/login-page'
import { AUTH_BUTTON, AUTH_INPUT, AuthCard, Splash } from '@/features/auth/screens'
import { crossTo } from '@/lib/accounts'
import { errorMessage } from '@/lib/errors'
import { neon } from '@/lib/neon'
import { cn } from '@/lib/utils'
import { slugFrom, slugProblem } from './slug'

/**
 * Start a new organization. The email signed in on this page (given on the way here, see
 * login-page.tsx) creates it and is its first admin. Only for the emails the database lists as
 * allowed: everyone else goes back to the email step, which says why, and the database refuses
 * them anyway.
 */
export function CreateOrgPage() {
  const navigate = useNavigate()
  const { can_create: canCreate } = useMyOrgs()
  const email = neon.auth.useSession().data?.user.email ?? ''
  const otherEmail = () => crossTo('/signup')
  const toOrgs = { label: 'Your organizations', onClick: () => navigate({ to: '/organizations' }) }
  const createOrg = useCreateOrg()
  const [name, setName] = useState('')
  // Until the address is typed by hand, it follows the name.
  const [typedSlug, setTypedSlug] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const slug = typedSlug ?? slugFrom(name)
  const problem = slugProblem(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!name.trim() || problem) return
    createOrg.mutate({ name, slug }, { onSuccess: (org) => navigate({ to: '/$org', params: { org: org.slug } }) })
  }

  // An email that may not create organizations goes back to the email step, which says so.
  if (!canCreate) return <SendBack email={email} />

  const slugError = attempted && problem ? problem : createOrg.isError ? errorMessage(createOrg.error) : undefined

  return (
    <AuthCard back={toOrgs} title="Create an organization" description="Give it a name and a URL. You can invite your team next.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 text-left">
        <div className="bg-surface border-line flex h-11 items-center gap-3 rounded-xl border pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate text-[15px]">{email}</span>
          <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary h-8 rounded-md px-2.5 text-sm" onClick={otherEmail}>
            Change
          </Button>
        </div>
        <Field label="Name" error={attempted && !name.trim() ? 'Give it a name.' : undefined}>
          <TextInput autoFocus placeholder="Acme" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className={AUTH_INPUT} />
        </Field>
        {/* The site's address stays in front, so the whole link reads as it is typed. */}
        <Field label="URL" id="org-url" error={slugError}>
          <span
            className={cn(
              'bg-surface flex h-11 items-center rounded-xl border px-3.5 text-[15px] shadow-[0_1px_2px_hsl(var(--shadow)/0.05)] transition-colors focus-within:border-(--brand)',
              slugError ? 'border-danger' : 'border-line',
            )}
          >
            <span className="text-quiet flex-none select-none">{window.location.host}/</span>
            <input
              placeholder="acme"
              id="org-url"
              value={slug}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(slugError)}
              onChange={(event) => setTypedSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="text-ink placeholder:text-quiet/70 h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
        </Field>
        <Button type="submit" size="lg" disabled={createOrg.isPending} className={`${AUTH_BUTTON} mt-2`}>
          {createOrg.isPending ? 'Creating…' : 'Create organization'}
        </Button>
      </form>
    </AuthCard>
  )
}

/** Goes back to the email step, which says this email can't create organizations. */
function SendBack({ email }: { email: string }) {
  useEffect(() => backToCreateDenied(email), [email])
  return <Splash />
}
