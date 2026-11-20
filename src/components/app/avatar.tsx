import { initials } from '@/lib/roles'
import type { Member } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A person's initials in a circle. Dimmed for someone who was invited but hasn't signed in. */
export function Avatar({ member, className }: { member: Pick<Member, 'name' | 'email'> & { user_id?: string | null }; className?: string }) {
  const invitedOnly = member.user_id === null
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 flex-none place-items-center rounded-full font-[550] text-[12px] [font-family:var(--font-rounded)]',
        invitedOnly ? 'text-quiet border border-dashed border-[color-mix(in_srgb,var(--quiet)_50%,transparent)]' : 'bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[color-mix(in_srgb,var(--brand)_70%,var(--ink))]',
        className,
      )}
    >
      {initials(member)}
    </span>
  )
}
