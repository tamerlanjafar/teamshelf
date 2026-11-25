import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Link, useRouterState } from '@tanstack/react-router'
import { Inbox, Plus, Settings, Users } from 'lucide-react'
import { createContext, use, useState, type ReactNode } from 'react'
import { useRequestsIfLoaded } from '@/api/links'
import { useSpacesIfLoaded } from '@/api/spaces'
import { useOrg } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { NewSpaceDialog } from '@/features/spaces/new-space-dialog'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { cn } from '@/lib/utils'
import { Wordmark } from './brand'
import { OrgSwitcher } from './org-switcher'

const DrawerContext = createContext<{ open: () => void } | null>(null)

/** Opens the sidebar on a phone, where it is a drawer. For the top bar's menu button. */
export const useOpenSidebar = () => use(DrawerContext)?.open ?? (() => {})

/**
 * The frame of every page of an organization: the sidebar at the left, the page beside it.
 * On a phone the sidebar is a drawer instead, opened from the top bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  // The drawer stays open on the page it was opened on: going somewhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const drawer = openOn === path
  const setDrawer = (open: boolean) => setOpenOn(open ? path : null)

  return (
    <DrawerContext value={{ open: () => setDrawer(true) }}>
      <div className="md:grid md:grid-cols-[252px_minmax(0,1fr)]">
        {/* The page with a breath of the brand's indigo, and a hairline: set apart from the page, but quietly. */}
        <aside className="border-line sticky top-0 hidden h-dvh border-r bg-[color-mix(in_srgb,var(--brand)_8%,var(--page))] md:flex">
          <Sidebar />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/25 duration-150 md:hidden" />
          <DialogPrimitive.Popup
            aria-label="Spaces and pages"
            className="bg-page data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left fixed inset-y-0 left-0 z-50 flex w-[min(300px,calc(100vw-56px))] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl duration-200 outline-none md:hidden"
          >
            <Sidebar />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </DrawerContext>
  )
}

/**
 * Everything of the organization in one column: the spaces you can see (private ones only if
 * you are in them), the organization's own pages, and at the bottom the organization you are in,
 * with the way to the others and to signing out.
 */
function Sidebar() {
  const org = useOrg()
  const spaces = useSpacesIfLoaded()
  const { admin, canManage, isSpaceAdmin } = usePermissions()
  const requests = useRequestsIfLoaded()
  // A reviewer is told how many suggestions wait for them, in every space they run.
  const waiting = requests.filter((link) => link.status === 'pending' && canManage(link)).length
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex min-h-0 w-full flex-col px-3 pt-1 pb-3">
      <div className="flex h-[64px] flex-none items-center px-2.5">
        <Link to="/$org" params={{ org: org.slug }} aria-label={`${org.name}, links`} className="outline-none">
          <Wordmark className="text-[24px]" />
        </Link>
      </div>

      {/* The spaces take the room there is, and scroll on their own when there are many; the
          organization's pages stay at the bottom, always in reach. */}
      <nav aria-label={org.name} className="flex min-h-0 flex-1 flex-col pt-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Anyone in the organization can start a space: a + by the heading, in the same place however many spaces there are. */}
          <Heading
            action={
              <button
                type="button"
                aria-label="New space"
                onClick={() => setCreating(true)}
                className="text-quiet hover:text-ink hover:bg-ink/[0.07] focus-visible:ring-brand/50 -my-1 grid size-7 flex-none place-items-center rounded-md outline-none transition-colors focus-visible:ring-2"
              >
                <Plus className="size-[18px]" />
              </button>
            }
          >
            Spaces
          </Heading>
          {/* The negative margin keeps the items' focus rings unclipped by the scrolling. */}
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-0.5">
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {spaces.map((space) => {
                const settings = isSpaceAdmin(space.id)
                return (
                  // For a space's admins, a gear to its settings at the right of the line: on the open
                  // space, and on the line pointed at or focused. (Who sees a space is in the top bar.) The gear is a link of its own beside the line's, as links don't nest.
                  <li key={space.id} className="group/space relative">
                    <Link to="/$org/$space" params={{ org: org.slug, space: space.slug }} activeOptions={{ includeSearch: false }} className={cn(ITEM, settings && 'group-hover/space:text-ink group-hover/space:not-aria-[current=page]:bg-ink/[0.055] pr-10')}>
                      {/* The line stays lit while pointing at its gear, which sits over it. */}
                      <SpaceLogo space={space} className="size-[22px] rounded-xs transition-transform duration-200 ease-out group-hover/space:scale-[1.08]" />
                      <span className="min-w-0 flex-1 truncate">{space.name}</span>
                    </Link>
                    {settings && (
                      <Link
                        to="/$org/$space/settings"
                        params={{ org: org.slug, space: space.slug }}
                        aria-label={`${space.name} settings`}
                        className={cn(
                          'text-quiet hover:text-ink hover:bg-ink/[0.07] focus-visible:ring-brand/50 absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md outline-none transition-[color,background-color,opacity] duration-150 focus-visible:ring-2',
                          'opacity-0 group-hover/space:opacity-100 group-focus-within/space:opacity-100 group-has-[[aria-current=page]]/space:opacity-100',
                        )}
                        activeProps={{ className: 'text-brand! bg-[color-mix(in_srgb,var(--brand)_11%,transparent)]' }}
                      >
                        <Settings className="size-4" />
                      </Link>
                    )}
                  </li>
                )
              })}
              {/* With no spaces yet, a line of its own says how to start. */}
              {spaces.length === 0 && (
                <li>
                  <button type="button" onClick={() => setCreating(true)} className={cn(ITEM, 'text-quiet w-full')}>
                    <span className="group-hover:border-brand group-hover:text-brand grid size-[22px] place-items-center rounded-xs border border-dashed border-[color-mix(in_srgb,var(--quiet)_55%,transparent)] transition-colors duration-150">
                      <Plus className="size-3.5" />
                    </span>
                    New space
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-line mt-3 flex-none border-t pt-3 pb-3">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li>
              <Link to="/$org/requests" params={{ org: org.slug }} className={ITEM}>
                <Inbox className={ICON} />
                <span className="min-w-0 flex-1 truncate">Suggestions</span>
                {waiting > 0 && (
                  <span aria-label={`${waiting} waiting`} className="bg-brand text-on-brand grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums [font-family:var(--font-rounded)]">
                    {waiting}
                  </span>
                )}
              </Link>
            </li>
            {admin && (
              <li>
                <Link to="/$org/team" params={{ org: org.slug }} className={ITEM}>
                  <Users className={ICON} />
                  Team
                </Link>
              </li>
            )}
            {admin && (
              <li>
                <Link to="/$org/settings" params={{ org: org.slug }} className={ITEM}>
                  <Settings className={ICON} />
                  Organization settings
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="flex-none">
        <OrgSwitcher />
      </div>
      <NewSpaceDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

/**
 * A line of the sidebar. Hovering tints it; the open one (the router marks it aria-current)
 * is raised on a white chip, like the chosen option of a segmented control.
 */
const ITEM = cn(
  'group text-ink/75 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-[14px] outline-none',
  'transition-[background-color,color,box-shadow] duration-150 ease-out',
  'hover:bg-ink/[0.055] hover:text-ink focus-visible:ring-brand/50 focus-visible:ring-2 focus-visible:ring-inset',
  'aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:font-semibold aria-[current=page]:shadow-[0_1px_2px_hsl(var(--shadow)/0.1),0_0_0_1px_var(--line)]',
  // On the dark sidebar a surface chip would sink: a lighter tint stands out instead.
  'dark:aria-[current=page]:bg-[color-mix(in_srgb,var(--ink)_11%,transparent)] dark:aria-[current=page]:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent)]',
)

/** An item's icon: quiet, darker on hover, the brand color when open. */
const ICON = 'text-quiet group-hover:text-ink group-aria-[current=page]:text-brand size-[18px] flex-none transition-colors duration-150'

/** A section's name, with an optional small button at its right. */
function Heading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 pr-1 pl-2.5">
      <h2 className="text-quiet m-0 min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.07em] uppercase">{children}</h2>
      {action}
    </div>
  )
}
