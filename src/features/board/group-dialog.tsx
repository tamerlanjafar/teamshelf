import { useState, type FormEvent } from 'react'
import { useUpdateGroup } from '@/api/groups'
import { Dialog, DialogFooter, DialogHeader, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/app/form'
import { ColorPicker } from '@/components/app/color-picker'
import { toastError } from '@/lib/errors'
import type { Group } from '@/lib/types'

/** Rename a group and choose its color. Super admin only. */
export function GroupDialog({ group, open, onOpenChange }: { group: Group; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[18px] sm:max-w-[420px]">
        {/* Mounted with the dialog, so the form starts from the group as it is now. */}
        <GroupForm group={group} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const updateGroup = useUpdateGroup()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    updateGroup.mutate({ id: group.id, name, color }, { onSuccess: onDone, onError: toastError })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">Edit group</DialogTitle>
      </DialogHeader>
      <Field label="Name">
        <TextInput value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateGroup.isPending || !name.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
