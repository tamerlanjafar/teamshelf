import { Link } from '@tanstack/react-router'
import { Inbox, Plus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRequestsIfLoaded } from '@/api/links'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/features/org/org-context'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { SpaceSwitcher } from '@/features/spaces/space-switcher'
import { cn } from '@/lib/utils'
import { OrgSwitcher } from './org-switcher'
import { UserMenu } from './user-menu'

/**
 * The bar at the top of every page: the organization, the open space, whatever the page puts
 * in the middle (the board puts its search there), and the ways to the other pages.
 *
 * Wide screens get one line. Below that the middle part gets a line of its own under the rest,
 * and on a phone the organization shrinks to its mark and Team moves into the account menu,
 * so the space's name keeps its room.
 */
export function TopBar({ children }: { children?: ReactNode }) {
  const { admin, reviewer, canManage, isSpaceAdmin } = usePermissions()
  const space = useCurrentSpaceIfLoaded()
  const { addLink } = useLinkDialog()
  const requests = useRequestsIfLoaded()
  // A reviewer is told how many suggestions wait for them, in every space they run.
  const waiting = requests.filter((link) => link.status === 'pending' && canManage(link)).length
  const publishes = isSpaceAdmin(space?.id)

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-1.5 gap-y-2.5 px-4 py-3 backdrop-blur-xl sm:gap-x-2 sm:px-5">
      <OrgSwitcher />
      <span aria-hidden="true" className="text-quiet/50 -mx-0.5 text-[18px] font-light max-md:hidden">
        /
      </span>
      <div className="flex min-w-0 flex-1 lg:max-w-[240px] lg:flex-none">
        <SpaceSwitcher />
      </div>

      {/* The middle (the board's search) stays a comfortable width, centered in the room it has. */}
      {children && <div className="flex min-w-0 items-center justify-center gap-x-2 max-lg:order-last max-lg:basis-full lg:flex-1">{children}</div>}

      <div className="ml-auto flex flex-none items-center gap-1.5 sm:gap-2">
        {space && (
          <Button onClick={() => addLink()} aria-label={publishes ? 'Add link' : 'Suggest link'} className="size-10 gap-2 rounded-xl border-0 px-0 text-[14px] shadow-[0_1px_2px_hsl(var(--shadow)/0.2)] sm:w-auto sm:px-3.5">
            <Plus />
            <span className="max-sm:hidden">{publishes ? 'Add' : 'Suggest'}</span>
          </Button>
        )}
        <NavButton to="/$org/requests" label={reviewer ? 'Review suggestions' : 'Your suggestions'} badge={waiting}>
          <Inbox className="size-5" />
        </NavButton>
        {admin && (
          <NavButton to="/$org/team" label="Team" className="max-sm:hidden">
            <Users className="size-5" />
          </NavButton>
        )}
        <UserMenu />
      </div>
    </header>
  )
}

function NavButton({ to, label, badge = 0, className, children }: { to: '/$org/requests' | '/$org/team'; label: string; badge?: number; className?: string; children: ReactNode }) {
  const org = useOrg()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={to}
            params={{ org: org.slug }}
            aria-label={badge > 0 ? `${label}, ${badge} waiting` : label}
            className={cn('bg-surface border-line text-quiet hover:text-ink relative grid size-10 flex-none place-items-center rounded-xl border transition-colors', className)}
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
