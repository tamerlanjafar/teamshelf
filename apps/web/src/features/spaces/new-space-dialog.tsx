import { useState, type FormEvent } from 'react'
import { toast } from '@/components/ui/toast'
import { useCreateSpace } from '@/api/spaces'
import { ColorPicker } from '@/components/app/color-picker'
import { Field, TextInput } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toastError } from '@/lib/errors'
import type { Color } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useOpenSpace } from './current-space'
import { LogoPicker, UploadLogoButton } from './logo-picker'
import { isImageLogo, SpaceLogo } from './space-logo'

/**
 * Starts a space. Anyone in the organization; whoever creates it is its first admin, and it starts
 * private (the database's create_space): only they see it until they add people or open it.
 */
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
  const openSpace = useOpenSpace()
  const image = isImageLogo(logo)
  const preview = { name: name || 'New space', logo, color }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    createSpace.mutate(
      { name, logo, color },
      {
        onError: toastError,
        onSuccess: (space) => {
          toast.success(`${space.name} is ready. Add groups to it, and its people in its settings.`)
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
        <DialogDescription>Only you see it until you add people or open it to everyone.</DialogDescription>
      </DialogHeader>
      <Field label="Name">
        <TextInput value={name} maxLength={40} autoFocus placeholder="Team or area" onChange={(event) => setName(event.target.value)} />
      </Field>

      {/* The space as it will look, as in its settings' Logo and color. */}
      <div className="bg-well flex flex-wrap items-center gap-4 rounded-lg p-4">
        <SpaceLogo space={preview} className="size-14 rounded-lg shadow-[0_2px_8px_hsl(var(--shadow)/0.12)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-[650] [font-family:var(--font-rounded)]">{preview.name}</div>
          <div className="text-quiet text-[12.5px]">{image ? 'Using your uploaded image' : 'Pick an icon and a color, or upload an image'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {image && (
            <Button type="button" variant="ghost" onClick={() => setLogo('grid')}>
              Use an icon
            </Button>
          )}
          <UploadLogoButton onChange={setLogo} />
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Icon</span>
        <LogoPicker space={preview} onChange={setLogo} />
      </div>
      {/* Colors tint icons only, so with an image they are dimmed. */}
      <div className={cn('grid gap-2 transition-opacity', image && 'opacity-45')}>
        <span className="text-[13px] font-medium">
          Color{image && <span className="text-quiet font-normal"> · tints icons, not images</span>}
        </span>
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
