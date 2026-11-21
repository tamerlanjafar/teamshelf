import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useRejectLink } from '@/api/links'
import { Field, TextInput } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'
import { IconButton } from './icon-button'

/** Rejects a suggestion, with an optional reason for the person who sent it. */
export function RejectButton({ link }: { link: Link }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const rejectLink = useRejectLink()

  function submit(event: FormEvent) {
    event.preventDefault()
    rejectLink.mutate({ id: link.id, reason }, { onSuccess: () => setOpen(false), onError: toastError })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <IconButton label="Reject" danger render={<PopoverTrigger />}>
        <X />
      </IconButton>
      <PopoverContent align="end" className="w-80 rounded-xl">
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Reason (optional)" hint="They see it next to their suggestion.">
            <TextInput autoFocus value={reason} maxLength={300} placeholder="Why it isn't going on the board" onChange={(event) => setReason(event.target.value)} />
          </Field>
          <Button type="submit" variant="destructive" size="lg" disabled={rejectLink.isPending} className="justify-self-end">
            Reject suggestion
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
