import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface Confirmation {
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
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

function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: Confirmation & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[18px] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="[font-family:var(--font-rounded)]">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
