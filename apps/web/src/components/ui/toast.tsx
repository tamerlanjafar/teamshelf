import { Toast } from '@base-ui/react/toast'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// One manager for the whole app, so a toast can be shown from anywhere: a click handler, a
// mutation's callback, code that isn't a component.
const manager = Toast.createToastManager()

interface ToastOptions {
  description?: ReactNode
  /** One thing to do about it, like undoing what was just done. Doing it closes the toast. */
  action?: { label: string; onClick: () => void }
  /** How long it stays, in milliseconds. */
  duration?: number
}

function show(type: 'success' | 'error' | undefined, title: ReactNode, { description, action, duration }: ToastOptions = {}) {
  const id = manager.add({
    type,
    title,
    description,
    // Long enough to read, no longer. An error, or something that can be undone, gets a little more.
    timeout: duration ?? (type === 'error' || action ? 5000 : 3000),
    // An error is announced at once.
    priority: type === 'error' ? 'high' : 'low',
    actionProps: action && {
      children: action.label,
      onClick: () => {
        action.onClick()
        manager.close(id)
      },
    },
  })
  return id
}

/** Says something briefly, in the bottom right corner. */
export const toast = Object.assign((title: ReactNode, options?: ToastOptions) => show(undefined, title, options), {
  success: (title: ReactNode, options?: ToastOptions) => show('success', title, options),
  error: (title: ReactNode, options?: ToastOptions) => show('error', title, options),
})

/** Where toasts appear. Rendered once, by the app's layout. */
export function Toaster() {
  return (
    <Toast.Provider toastManager={manager} limit={3}>
      <Toast.Portal>
        {/* Bottom right, above mock mode's toolbar where there is one. */}
        <Toast.Viewport className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100%-2rem)] max-w-[380px] flex-col-reverse gap-2 outline-none [body:has(#mock-toolbar)_&]:bottom-[84px]">
          <Toasts />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function Toasts() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      // Swiped away to the right, where it came from.
      swipeDirection="right"
      className={cn(
        'bg-popover text-popover-foreground pointer-events-auto relative rounded-xl border shadow-[0_1px_2px_hsl(var(--shadow)/0.06),0_12px_32px_-12px_hsl(var(--shadow)/0.28)]',
        'transition-[opacity,translate] duration-200 ease-out data-[starting-style]:translate-x-4 data-[starting-style]:opacity-0 data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0',
        // Beyond the limit: out of the way until the ones before it are gone.
        'data-[limited]:hidden',
      )}
    >
      <Toast.Content className="flex items-center gap-3 py-3 pr-3 pl-3.5">
        {item.type === 'success' && <CircleCheck className="size-[18px] flex-none text-emerald-600 dark:text-emerald-400" />}
        {item.type === 'error' && <CircleAlert className="text-destructive size-[18px] flex-none" />}
        <div className="min-w-0 flex-1">
          <Toast.Title className="m-0 text-[14px] leading-snug font-medium" />
          <Toast.Description className="text-muted-foreground m-0 mt-0.5 text-[13px] leading-snug" />
        </div>
        <Toast.Action className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-none')} />
        <Toast.Close aria-label="Dismiss" className="text-muted-foreground hover:text-foreground hover:bg-accent grid size-7 flex-none place-items-center rounded-md transition-colors">
          <X className="size-4" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}
