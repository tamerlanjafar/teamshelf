import { Send, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from '@/components/ui/toast'
import { useInviteMember } from '@/api/members'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, TextInput } from '@/components/app/form'
import { useOrg } from '@/features/org/org-context'
import { errorMessage } from '@/lib/errors'
import { isEmail } from '@/lib/neon'
import { cn } from '@/lib/utils'
import { INVITE_ROLES, type InviteRole } from './roles'

/** The Team page's main action: invites someone by email, at any domain, in a dialog. */
export function InviteButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Invite
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl sm:max-w-[440px]">{open && <InviteForm onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  )
}

/** An email and a role, each role with a line saying what it may do. Sends a sign-in link. */
function InviteForm({ onDone }: { onDone: () => void }) {
  const org = useOrg()
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
          onDone()
        },
        onError: (failure) => setError(errorMessage(failure)),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">Invite to {org.name}</DialogTitle>
      </DialogHeader>
      <Field label="Email" error={error}>
        <TextInput
          type="email"
          autoFocus
          placeholder="name@example.com"
          value={email}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(undefined)
          }}
          className="h-10"
        />
      </Field>
      <div role="radiogroup" aria-label="Role" className="grid gap-2">
        <span className="text-[13px] font-medium">Role</span>
        {INVITE_ROLES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={role === option.value}
            onClick={() => setRole(option.value)}
            className={cn(
              'flex items-start gap-3 rounded-md border p-3 text-left transition-colors',
              role === option.value ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]' : 'border-line hover:border-[color-mix(in_srgb,var(--ink)_20%,transparent)]',
            )}
          >
            <span className={cn('mt-0.5 size-4 flex-none rounded-full border-2', role === option.value ? 'border-brand border-[5px]' : 'border-line')} />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="text-quiet block text-[12.5px] leading-snug">{option.detail}</span>
            </span>
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          <Send />
          {invite.isPending ? 'Sending…' : 'Send invite'}
        </Button>
      </DialogFooter>
    </form>
  )
}
