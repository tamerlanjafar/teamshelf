import { Link, useMatch } from '@tanstack/react-router'
import { Globe, Lock, Menu, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/features/org/org-context'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded, useSpaceParam } from '@/features/spaces/current-space'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { QuickFind } from '@/features/search/quick-find'
import { cn } from '@/lib/utils'
import { Wordmark } from './brand'
import { useOpenSidebar } from './sidebar'

/**
 * The bar at the top of every page: the open space (and, for its admins, the way to its settings)
 * on the left. On a board only: the search in the middle with whatever the board adds beside it
 * (the count of what you hid), and adding a link on the right. Everything else is in the sidebar.
 *
 * Wide screens get one line, with the search centered. Below that the search gets a line of its
 * own under the rest. On a phone a menu button opens the sidebar. A page with nothing else for the bar
 * (Team, Suggestions, settings, a space's settings) has it on phones only: that button, and the
 * way back (the space, or the wordmark).
 */
export function TopBar({ children, tools, quiet = false }: { children?: ReactNode; /** Quiet controls of the board, before the button that adds a link. */ tools?: ReactNode; /** Without the search and the button that adds a link: only the space, and what the page puts in the middle. */ quiet?: boolean }) {
  const { isSpaceAdmin } = usePermissions()
  const space = useCurrentSpaceIfLoaded()
  const onSpace = Boolean(useSpaceParam())
  const onBoard = Boolean(useMatch({ from: '/_app/$org/$space/', shouldThrow: false }))
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
        {onSpace && space && <SpaceTitle space={space} admin={publishes} onBoard={onBoard} />}
        {/* A page outside any space (on a phone, where this bar shows): the wordmark, back to the board. */}
        {!onSpace && <BackToBoard />}
      </div>

      {/* On a board: the search finds and opens any link of the space. A comfortable width, centered. */}
      {boardTools && (
        <div className="flex min-w-0 items-center justify-center gap-2 max-xl:order-last max-xl:basis-full xl:w-[520px]">
          {!quiet && <QuickFind />}
          {children}
        </div>
      )}

      <div className="ml-auto flex flex-none items-center justify-end gap-1.5 sm:gap-2 xl:col-start-3">
        {boardTools && tools}
        {boardTools && !quiet && (
          <Button onClick={() => addLink()} aria-label={publishes ? 'Add link' : 'Suggest link'} className="size-10 gap-2 rounded-lg border-0 px-0 text-[14px] shadow-[0_1px_2px_hsl(var(--shadow)/0.2)] sm:w-auto sm:px-3.5">
            <Plus />
            <span className="max-sm:hidden">{publishes ? 'Add' : 'Suggest'}</span>
          </Button>
        )}
      </div>
    </header>
  )
}

/** The wordmark, opening the organization's board (the space opened last). */
function BackToBoard() {
  const org = useOrg()
  return (
    <Link to="/$org" params={{ org: org.slug }} aria-label="Back to the board" className="ml-0.5 flex items-center rounded-md">
      <Wordmark className="text-[20px]" />
    </Link>
  )
}

/**
 * Who sees the open space, after its name: a lock on amber when it is private, a globe on green
 * when everyone in the organization sees it. The word is there for screen readers.
 */
function Visibility({ space }: { space: { visibility: string } }) {
  const open = space.visibility !== 'private'
  const Icon = open ? Globe : Lock
  return (
    <span className={cn('grid size-[22px] flex-none place-items-center rounded-full', open ? 'bg-open-fill text-open' : 'bg-private-fill text-private')}>
      <Icon className="size-[13px]" strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">{open ? 'Everyone' : 'Private'}</span>
    </span>
  )
}

/**
 * The open space's logo, name and who sees it, and for its admins a button to its settings. The
 * logo and name lead back to the board from a page under it (on a phone); on the board itself
 * they are only its title.
 */
function SpaceTitle({ space, admin, onBoard }: { space: NonNullable<ReturnType<typeof useCurrentSpaceIfLoaded>>; admin: boolean; onBoard: boolean }) {
  const org = useOrg()
  const title = (
    <>
      <SpaceLogo space={space} />
      <span className="truncate text-[17px] font-[650] tracking-[-0.01em] [font-family:var(--font-rounded)]">{space.name}</span>
    </>
  )
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {onBoard ? (
        <div className="flex min-w-0 items-center gap-2.5">{title}</div>
      ) : (
        <Link to="/$org/$space" params={{ org: org.slug, space: space.slug }} className="flex min-w-0 items-center gap-2.5 rounded-lg">
          {title}
        </Link>
      )}
      <Visibility space={space} />
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
