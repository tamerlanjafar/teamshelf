import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useCreateOrg, useMyOrgs } from '@/api/orgs'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, TextInput } from '@/components/app/form'
import { AUTH_BUTTON, AuthCard } from '@/features/auth/screens'
import { errorMessage } from '@/lib/errors'
import { slugFrom, slugProblem } from './slug'

/**
 * Start a new organization. Whoever creates it is its super admin. Only for the accounts the
 * database lists as allowed (the app hides the form from everyone else, the database refuses them).
 */
export function CreateOrgPage() {
  const navigate = useNavigate()
  const { can_create: canCreate } = useMyOrgs()
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
    createOrg.mutate({ name, slug }, { onSuccess: (org) => navigate({ to: '/$org', params: { org: org.slug }, search: {} }) })
  }

  if (!canCreate) {
    return (
      <AuthCard title="You can't create organizations" description="Creating organizations is limited to a few accounts. Ask an admin of an existing organization to invite you.">
        <Link to="/organizations" className={buttonVariants({ size: 'lg', className: AUTH_BUTTON })}>
          Your organizations
        </Link>
      </AuthCard>
    )
  }

  const slugError = attempted && problem ? problem : createOrg.isError ? errorMessage(createOrg.error) : undefined

  return (
    <AuthCard title="Create an organization" description="Set up a board for your team's links. You'll manage it and can invite others.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 text-left">
        <Field label="Name" error={attempted && !name.trim() ? 'Give it a name.' : undefined}>
          <TextInput autoFocus placeholder="Acme" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="h-10" />
        </Field>
        <Field label="Address" error={slugError} hint={`${window.location.host}/${slug || 'acme'}`}>
          <TextInput
            placeholder="acme"
            value={slug}
            maxLength={40}
            aria-invalid={Boolean(slugError)}
            onChange={(event) => setTypedSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="h-10"
          />
        </Field>
        <div className="mt-2 flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={createOrg.isPending} className={AUTH_BUTTON}>
            {createOrg.isPending ? 'Creating…' : 'Create organization'}
          </Button>
          <Link to="/organizations" className={buttonVariants({ variant: 'ghost', size: 'lg', className: `${AUTH_BUTTON} text-quiet` })}>
            Back
          </Link>
        </div>
      </form>
    </AuthCard>
  )
}
