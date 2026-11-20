import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useUpdateOrg } from '@/api/orgs'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/app/form'
import { useOrg } from '@/features/org/org-context'
import { toastError } from '@/lib/errors'
import { parseDomains } from './domains'

/** The organization's name, and the email domains whose people can join without an invitation. */
export function OrgForm() {
  const org = useOrg()
  const updateOrg = useUpdateOrg()
  const [name, setName] = useState(org.name)
  const [domainText, setDomainText] = useState(org.allowed_domains.join(', '))
  const [domainError, setDomainError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseDomains(domainText)
    if ('error' in parsed) {
      setDomainError(parsed.error)
      return
    }
    if (!name.trim()) return
    updateOrg.mutate(
      { org, changes: { name: name.trim(), allowed_domains: parsed.domains } },
      {
        onError: toastError,
        onSuccess: () => {
          setDomainText(parsed.domains.join(', '))
          toast.success('Saved.')
        },
      },
    )
  }

  return (
    <section>
      <h2 className="text-quiet mx-1 mb-2.5 text-[13px] font-semibold">Organization</h2>
      <form onSubmit={submit} noValidate className="bg-raised border-line grid gap-4 rounded-[14px] border p-4">
        <Field label="Name" hint={`Its address is ${window.location.host}/${org.slug} and can't be changed.`}>
          <TextInput value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field
          label="Email domains that can join without an invitation"
          error={domainError}
          hint="Anyone who signs in with an email at one of these domains can join as a member. Leave it empty to make the organization invitation-only. Admins can always invite people at any domain."
        >
          <TextInput
            placeholder="example.com, example.org"
            value={domainText}
            aria-invalid={Boolean(domainError)}
            onChange={(event) => {
              setDomainText(event.target.value)
              setDomainError(undefined)
            }}
          />
        </Field>
        <Button type="submit" disabled={updateOrg.isPending || !name.trim()} className="justify-self-start">
          {updateOrg.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  )
}
