import { Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useInviteMember } from '@/api/members'
import { Button } from '@/components/ui/button'
import { Segmented, TextInput } from '@/components/app/form'
import { errorMessage } from '@/lib/errors'
import { isEmail } from '@/lib/neon'
import { INVITE_ROLES, type InviteRole } from './roles'

/** Adds someone by email, at any domain, and sends them a sign-in link. */
export function InviteForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('member')
  const [error, setError] = useState<string>()
  const invite = useInviteMember()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter an email address.')
      return
    }
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${email.trim().toLowerCase()}.`)
          setEmail('')
        },
        onError: (failure) => setError(errorMessage(failure)),
      },
    )
  }

  return (
    <section>
      <h2 className="text-quiet mx-1 mb-2.5 text-[13px] font-semibold">Invite someone</h2>
      <form onSubmit={submit} noValidate className="bg-raised border-line flex flex-wrap items-center gap-2.5 rounded-[14px] border p-3">
        <TextInput
          type="email"
          aria-label="Email"
          placeholder="name@example.com"
          value={email}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(undefined)
          }}
          className="min-w-[220px] flex-1"
        />
        <Segmented label="Role" options={INVITE_ROLES} value={role} onChange={setRole} />
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          <Send />
          {invite.isPending ? 'Sending…' : 'Send invite'}
        </Button>
        {error && <p className="text-danger m-0 basis-full px-1 text-[12.5px]">{error}</p>}
      </form>
    </section>
  )
}
