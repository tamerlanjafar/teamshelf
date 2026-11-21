import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface Confirmation {
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  /** Something that removes or discards (the default), or a change that loses nothing. */
  tone?: 'danger' | 'plain'
}

const ConfirmContext = createContext<((confirmation: Confirmation) => void) | null>(null)

/**
 * Returns a function that asks before something that can't be undone:
 * `confirm({ title, description, confirmLabel, onConfirm })`.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs a ConfirmProvider above it.')
  return confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // The last question stays while the dialog animates out.
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const confirm = useCallback((next: Confirmation) => {
    setConfirmation(next)
    setOpen(true)
  }, [])

  return (
    <ConfirmContext value={confirm}>
      {children}
      {confirmation && <ConfirmDialog open={open} onOpenChange={setOpen} {...confirmation} />}
    </ConfirmContext>
  )
}

/** A question with Cancel and the action. A click outside, or Escape, cancels it. */
function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, tone = 'danger' }: Confirmation & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="[font-family:var(--font-rounded)]">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
