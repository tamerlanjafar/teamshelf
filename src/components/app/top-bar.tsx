import { Link, useMatch } from '@tanstack/react-router'
import { Menu, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/features/org/org-context'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded, useSpaceParam } from '@/features/spaces/current-space'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { QuickFind } from '@/features/search/quick-find'
import { cn } from '@/lib/utils'
import { useOpenSidebar } from './sidebar'

/**
 * The bar at the top of every page: the open space (and, for its admins, the way to its settings)
 * on the left. On a board only: the search in the middle with whatever the board adds beside it
 * (the count of what you hid), and adding a link on the right. Everything else is in the sidebar.
 *
 * Wide screens get one line, with the search centered. Below that the search gets a line of its
 * own under the rest. On a phone a menu button opens the sidebar. A page with nothing for the bar
 * (Team, Suggestions, settings, a space's settings) has it on phones only, for that button.
 */
export function TopBar({ children }: { children?: ReactNode }) {
  const { isSpaceAdmin } = usePermissions()
  const space = useCurrentSpaceIfLoaded()
  const onSpace = Boolean(useSpaceParam())
  const onBoard = Boolean(useMatch({ from: '/$org/$space/', shouldThrow: false }))
  const boardTools = onBoard && space
  const { addLink } = useLinkDialog()
  const openSidebar = useOpenSidebar()
  const publishes = isSpaceAdmin(space?.id)

  return (
    <header className={cn('relative z-30 flex min-h-16 flex-wrap items-center gap-x-1.5 gap-y-2.5 px-4 py-3 sm:gap-x-2 sm:px-5 xl:grid xl:grid-cols-[1fr_auto_1fr]', !onBoard && 'md:hidden!')}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 xl:flex-none">
        <button type="button" onClick={openSidebar} aria-label="Spaces and pages" className="text-quiet hover:text-ink hover:bg-ink/6 -ml-1.5 grid size-10 flex-none place-items-center rounded-lg md:hidden">
          <Menu className="size-5" />
        </button>
        {onSpace && space && <SpaceTitle space={space} admin={publishes} />}
      </div>

      {/* On a board: the search finds and opens any link of the space. A comfortable width, centered. */}
      {boardTools && (
        <div className="flex min-w-0 items-center justify-center gap-2 max-xl:order-last max-xl:basis-full xl:w-[520px]">
          <QuickFind />
          {children}
        </div>
      )}

      <div className="ml-auto flex flex-none items-center justify-end gap-1.5 sm:gap-2 xl:col-start-3">
        {boardTools && (
          <Button onClick={() => addLink()} aria-label={publishes ? 'Add link' : 'Suggest link'} className="size-10 gap-2 rounded-lg border-0 px-0 text-[14px] shadow-[0_1px_2px_hsl(var(--shadow)/0.2)] sm:w-auto sm:px-3.5">
            <Plus />
            <span className="max-sm:hidden">{publishes ? 'Add' : 'Suggest'}</span>
          </Button>
        )}
      </div>
    </header>
  )
}

/** The open space's logo and name, and for its admins a button to its settings. */
function SpaceTitle({ space, admin }: { space: NonNullable<ReturnType<typeof useCurrentSpaceIfLoaded>>; admin: boolean }) {
  const org = useOrg()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link to="/$org/$space" params={{ org: org.slug, space: space.slug }} className="flex min-w-0 items-center gap-2.5 rounded-lg">
        <SpaceLogo space={space} />
        <span className="truncate text-[17px] font-[650] tracking-[-0.01em] [font-family:var(--font-rounded)]">{space.name}</span>
      </Link>
      {admin && (
        <Link
          to="/$org/$space/settings"
          params={{ org: org.slug, space: space.slug }}
          aria-label={`${space.name} settings`}
          className="text-quiet hover:text-ink hover:bg-ink/6 grid size-8 flex-none place-items-center rounded-lg transition-colors"
          activeProps={{ className: 'text-brand! bg-[color-mix(in_srgb,var(--brand)_11%,transparent)]' }}
        >
          <Settings className="size-[18px]" />
        </Link>
      )}
    </div>
  )
}
