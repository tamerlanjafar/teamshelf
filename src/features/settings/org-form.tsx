import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useChangeOrgSlug, useUpdateOrg } from '@/api/orgs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, TextInput } from '@/components/app/form'
import { useOrg } from '@/features/org/org-context'
import { slugProblem } from '@/features/org/slug'
import { errorMessage, toastError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { DomainsInput } from './domains-input'

/** The organization's name, and the email domains whose people can join without an invitation. */
export function OrgForm() {
  const org = useOrg()
  const updateOrg = useUpdateOrg()
  const [name, setName] = useState(org.name)
  const [domains, setDomains] = useState(org.allowed_domains)
  const [domainError, setDomainError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || domainError) return
    updateOrg.mutate({ org, changes: { name: name.trim(), allowed_domains: domains } }, { onError: toastError, onSuccess: () => toast.success('Saved.') })
  }

  return (
    <section>
      <h2 className="text-quiet mx-1 mb-2.5 text-[13px] font-semibold">Organization</h2>
      <form onSubmit={submit} noValidate className="bg-raised border-line grid gap-4 rounded-xl border p-4">
        <Field label="Name">
          <TextInput value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field
          label="Email domains that can join without an invitation"
          error={domainError}
          hint="Anyone who signs in with an email at one of these can join as a member. With none, people join by invitation only."
        >
          <DomainsInput value={domains} onChange={setDomains} onError={setDomainError} invalid={Boolean(domainError)} />
        </Field>
        <Button type="submit" disabled={updateOrg.isPending || !name.trim()} className="justify-self-start">
          {updateOrg.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  )
}

/** The organization's address, and changing it, with what that breaks said before it happens. */
export function OrgUrl() {
  const org = useOrg()
  const [changing, setChanging] = useState(false)
  return (
    <section>
      <h2 className="text-quiet mx-1 mb-2.5 text-[13px] font-semibold">URL</h2>
      <div className="bg-raised border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <span className="min-w-0 truncate">
          <span className="text-quiet">{window.location.host}/</span>
          <span className="font-medium">{org.slug}</span>
        </span>
        <Button variant="outline" onClick={() => setChanging(true)}>
          Change URL…
        </Button>
      </div>
      <Dialog open={changing} onOpenChange={setChanging}>
        <DialogContent className="rounded-xl sm:max-w-[460px]">{changing && <ChangeUrl onDone={() => setChanging(false)} />}</DialogContent>
      </Dialog>
    </section>
  )
}

function ChangeUrl({ onDone }: { onDone: () => void }) {
  const org = useOrg()
  const change = useChangeOrgSlug()
  const [slug, setSlug] = useState(org.slug)
  const [attempted, setAttempted] = useState(false)
  const problem = slug === org.slug ? 'Type a new URL.' : slugProblem(slug)
  const error = attempted && problem ? problem : change.isError ? errorMessage(change.error) : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (problem) return
    change.mutate({ org, slug })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">Change {org.name}'s URL</DialogTitle>
      </DialogHeader>
      <Field label="New URL" id="new-org-url" error={error}>
        <span className={cn('bg-well flex h-10 items-center rounded-md px-3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--brand)]', error && 'shadow-[inset_0_0_0_1px_var(--danger)]')}>
          <span className="text-quiet flex-none select-none">{window.location.host}/</span>
          <input
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            id="new-org-url"
            value={slug}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="h-full min-w-0 flex-1 bg-transparent outline-none"
          />
        </span>
      </Field>
      <div className="flex gap-2.5 rounded-md bg-[color-mix(in_srgb,#e08a1e_12%,transparent)] px-3 py-2.5 text-[13.5px] leading-snug">
        <TriangleAlert className="mt-0.5 size-4 flex-none text-[color-mix(in_srgb,#e08a1e_80%,var(--ink))]" />
        <span>
          Links to <span className="font-medium">/{org.slug}</span> will stop working.
        </span>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change URL'}
        </Button>
      </DialogFooter>
    </form>
  )
}
