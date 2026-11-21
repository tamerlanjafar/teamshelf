import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Link, useRouterState } from '@tanstack/react-router'
import { Inbox, Lock, Plus, Settings, Users } from 'lucide-react'
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
  const { admin, canManage } = usePermissions()
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

      {/* Scrolls on its own when there are many spaces. The negative margin keeps the items' focus rings unclipped. */}
      <nav aria-label={org.name} className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-1 pt-1 pb-4">
        <div>
          <Heading>Spaces</Heading>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link to="/$org/$space" params={{ org: org.slug, space: space.slug }} activeOptions={{ includeSearch: false }} className={ITEM}>
                  <SpaceLogo space={space} className="size-[22px] rounded-xs transition-transform duration-200 ease-out group-hover:scale-[1.08]" />
                  <span className="min-w-0 flex-1 truncate">{space.name}</span>
                  {space.visibility === 'private' && <Lock className="text-quiet size-3.5" aria-label="Private" />}
                </Link>
              </li>
            ))}
            {/* Anyone in the organization can start a space. */}
            <li>
              <button type="button" onClick={() => setCreating(true)} className={cn(ITEM, 'text-quiet w-full')}>
                <span className="group-hover:border-brand group-hover:text-brand grid size-[22px] place-items-center rounded-xs border border-dashed border-[color-mix(in_srgb,var(--quiet)_55%,transparent)] transition-colors duration-150">
                  <Plus className="size-3.5" />
                </span>
                New space
              </button>
            </li>
          </ul>
        </div>

        <div>
          <Heading>{org.name}</Heading>
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
)

/** An item's icon: quiet, darker on hover, the brand color when open. */
const ICON = 'text-quiet group-hover:text-ink group-aria-[current=page]:text-brand size-[18px] flex-none transition-colors duration-150'

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-quiet/85 m-0 mb-1 truncate px-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase">{children}</h2>
}
