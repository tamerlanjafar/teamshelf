import type { ReactElement, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * A quiet square button with only an icon, named by a tooltip. `render` lets another
 * component be the button itself (a popover's trigger, for example).
 */
export function IconButton({ label, danger = false, onClick, disabled, render, children }: { label: string; danger?: boolean; onClick?: () => void; disabled?: boolean; render?: ReactElement; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={render ?? <button type="button" />}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'text-quiet grid size-9 flex-none place-items-center rounded-lg transition-colors disabled:opacity-50 [&_svg]:size-[18px]',
          danger ? 'hover:text-danger hover:bg-danger/10' : 'hover:text-ink hover:bg-accent',
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
