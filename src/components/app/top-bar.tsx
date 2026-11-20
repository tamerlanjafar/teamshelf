import { Link } from '@tanstack/react-router'
import { Inbox, Plus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRequestsIfLoaded } from '@/api/links'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/features/org/org-context'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { cn } from '@/lib/utils'
import { OrgSwitcher } from './org-switcher'
import { UserMenu } from './user-menu'

/**
 * The bar at the top of every page: the brand, whatever the page puts in the middle
 * (the board puts its search there), and the ways to the other pages.
 */
export function TopBar({ children }: { children?: ReactNode }) {
  const { admin, reviewer, canManage } = usePermissions()
  const { addLink } = useLinkDialog()
  const requests = useRequestsIfLoaded()
  // A reviewer is told how many suggestions wait for them.
  const waiting = requests.filter((link) => link.status === 'pending' && canManage(link)).length

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2.5 max-sm:gap-x-2 px-5 py-3.5 backdrop-blur-xl">
      <OrgSwitcher />

      {/* On a phone the middle part gets a line of its own, below the buttons. */}
      <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2.5', children && 'max-sm:order-last max-sm:basis-full')}>{children}</div>

      <Button onClick={() => addLink()} className="h-11 gap-2 rounded-xl border-0 px-4 text-[14px] shadow-[0_1px_2px_hsl(var(--shadow)/0.2)]">
        <Plus />
        <span className="max-sm:hidden">{reviewer ? 'Add link' : 'Suggest link'}</span>
      </Button>
      <NavButton to="/$org/requests" label={reviewer ? 'Review suggestions' : 'Your suggestions'} badge={waiting}>
        <Inbox className="size-5" />
      </NavButton>
      {admin && (
        <NavButton to="/$org/team" label="Team">
          <Users className="size-5" />
        </NavButton>
      )}
      <UserMenu />
    </header>
  )
}

function NavButton({ to, label, badge = 0, children }: { to: '/$org/requests' | '/$org/team'; label: string; badge?: number; children: ReactNode }) {
  const org = useOrg()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={to}
            params={{ org: org.slug }}
            aria-label={badge > 0 ? `${label}, ${badge} waiting` : label}
            className="bg-surface border-line text-quiet hover:text-ink relative grid size-11 flex-none place-items-center rounded-xl border transition-colors"
            activeProps={{ className: 'border-brand! text-ink!' }}
          />
        }
      >
        {children}
        {badge > 0 && (
          <span className="bg-brand text-on-brand absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums [font-family:var(--font-rounded)]">
            {badge}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
