import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useCreateSpace } from '@/api/spaces'
import { ColorPicker } from '@/components/app/color-picker'
import { Field, TextInput } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toastError } from '@/lib/errors'
import type { Color } from '@/lib/types'
import { usePermissions } from '@/features/org/permissions'
import { useOpenSpace } from './current-space'
import { LogoPicker, UploadLogoButton } from './logo-picker'
import { SpaceLogo } from './space-logo'

/** Starts a space. Anyone in the organization; whoever creates it is its first admin. */
export function NewSpaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl sm:max-w-[480px]">{open && <NewSpaceForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function NewSpaceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [logo, setLogo] = useState('grid')
  const [color, setColor] = useState<Color>('indigo')
  const createSpace = useCreateSpace()
  // Only admins of the organization start spaces everyone sees; anyone else's are private.
  const { admin } = usePermissions()
  const openSpace = useOpenSpace()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name, logo, color },
      {
        onError: toastError,
        onSuccess: (space) => {
          toast.success(`${space.name} is ready. Add its people and groups in its settings.`)
          onDone()
          openSpace(space)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">New space</DialogTitle>
      </DialogHeader>
      <Field
        label="Name"
        hint={
          admin
            ? 'A team or an area of your organization. Everyone in the organization sees it until you make it private.'
            : 'A team or an area of your organization. It is private: only the people you add see it.'
        }
      >
        <TextInput value={name} maxLength={40} autoFocus placeholder="Team or area" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <SpaceLogo space={{ name: name || 'New space', logo, color }} className="size-6 rounded-xs" />
            Logo
          </span>
          <UploadLogoButton onChange={setLogo} className="h-8" />
        </div>
        <LogoPicker space={{ name: name || 'New space', logo, color }} onChange={setLogo} />
      </div>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={createSpace.isPending || !name.trim()}>
          {createSpace.isPending ? 'Creating…' : 'Create space'}
        </Button>
      </DialogFooter>
    </form>
  )
}
