import { useState, type FormEvent } from 'react'
import { useGroupAccess, useUpdateGroup } from '@/api/groups'
import { useSpacesIfLoaded } from '@/api/spaces'
import { Dialog, DialogFooter, DialogHeader, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/app/form'
import { ColorPicker } from '@/components/app/color-picker'
import { AudiencePicker } from '@/features/links/audience-picker'
import { audienceError, NO_ONE, type Chosen } from '@/features/links/link-draft'
import { useSpacePeople } from '@/features/spaces/space-people'
import { toastError } from '@/lib/errors'
import type { Group, Visibility } from '@/lib/types'

/** Rename a group, choose its color and who sees it. The space's admins. */
export function GroupDialog({ group, open, onOpenChange }: { group: Group; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-[520px]">
        {/* Mounted with the dialog, so the form starts from the group as it is now. */}
        <GroupForm group={group} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const space = useSpacesIfLoaded().find((one) => one.id === group.space_id)
  const people = useSpacePeople(space)
  const savedAccess = useGroupAccess(group.visibility === 'members' ? group.id : undefined)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [visibility, setVisibility] = useState<Visibility>(group.visibility ?? 'everyone')
  // null until changed: the group keeps the people and teams it already has.
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [attempted, setAttempted] = useState(false)
  const chosen = picked ?? savedAccess.data ?? NO_ONE
  const problem = audienceError(visibility, chosen)
  const updateGroup = useUpdateGroup()

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!name.trim() || problem) return
    // Who sees it is saved only when it changed, so a rename never touches the chosen people.
    const audience = visibility !== (group.visibility ?? 'everyone') || picked ? { visibility, ...chosen } : undefined
    updateGroup.mutate({ id: group.id, name, color, audience }, { onSuccess: onDone, onError: toastError })
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
      {space && (
        <AudiencePicker
          space={space}
          noun="group"
          audience={{ visibility, ...chosen }}
          members={people}
          error={attempted ? problem : undefined}
          onChange={({ visibility: next, memberIds, teamIds }) => {
            setVisibility(next)
            setPicked({ memberIds, teamIds })
          }}
        />
      )}
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
