import { useState, type FormEvent } from 'react'
import { groupsOf, useCreateGroup, useGroupsIfLoaded } from '@/api/groups'
import { ColorPicker } from '@/components/app/color-picker'
import { Field, TextInput } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { leastUsedColor } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import type { Color, Space } from '@/lib/types'

/** Starts a group (a card on the board) in a space. The space's admins. */
export function NewGroupDialog({ space, open, onOpenChange }: { space: Space; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[18px] sm:max-w-[420px]">{open && <NewGroupForm space={space} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function NewGroupForm({ space, onDone }: { space: Space; onDone: () => void }) {
  const groups = groupsOf(useGroupsIfLoaded(), space.id)
  const [name, setName] = useState('')
  const [color, setColor] = useState<Color>(() => leastUsedColor(groups.map((group) => group.color)))
  const createGroup = useCreateGroup()
  const taken = groups.some((group) => group.name.toLowerCase() === name.trim().toLowerCase())

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || taken) return
    createGroup.mutate({ spaceId: space.id, name, color }, { onSuccess: onDone, onError: toastError })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">New group in {space.name}</DialogTitle>
      </DialogHeader>
      <Field label="Name" error={taken ? `${space.name} already has a group called ${name.trim()}.` : undefined} hint="A card on the board, like Jenkins or Figma.">
        <TextInput value={name} maxLength={60} autoFocus aria-invalid={taken} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={createGroup.isPending || !name.trim() || taken}>
          Create group
        </Button>
      </DialogFooter>
    </form>
  )
}
