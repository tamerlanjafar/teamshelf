import { cn } from '@/lib/utils'

/** The first letter of an organization's name, in a rounded square. */
export function OrgBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('bg-primary/12 text-primary grid size-9 flex-none place-items-center rounded-md text-[15px] font-bold [font-family:var(--font-rounded)]', className)}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
