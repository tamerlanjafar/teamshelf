import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronRight, ChevronsUpDown, ListRestart, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSignedInOrgs, useSignOutOfOrg } from '@/api/accounts'
import { useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMe, useOrg } from '@/features/org/org-context'
import { crossTo } from '@/lib/accounts'
import { FEATURES } from '@/lib/features'
import { setThemeFrom, useTheme, type ThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { OrgBadge } from './org-badge'

/**
 * The organization you are in, at the bottom of the sidebar, with the email you are signed in
 * with there. Its menu has three parts: every organization signed in on this browser (each with
 * its email) and the Organizations page, where you sign in to or create another one; how
 * Teamshelf looks; and signing out of this organization only.
 */
export function OrgSwitcher() {
  const org = useOrg()
  const me = useMe()
  const navigate = useNavigate()
  const orgs = useSignedInOrgs()
  const signOut = useSignOutOfOrg()
  // With personal ordering switched on: a way back from your own order of the groups.
  const savePrefs = useSaveBoardPrefs()
  const prefs = useBoardPrefsIfLoaded()
  const ownGroupOrder = FEATURES.personalOrder && prefs.group_order.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${org.name}, signed in as ${me.email}. Switch organization`}
        className="bg-surface border-line hover:border-ink/15 focus-visible:ring-brand/50 data-[popup-open]:border-brand/40 flex w-full items-center gap-2.5 rounded-xl border p-2 text-left shadow-[0_1px_2px_hsl(var(--shadow)/0.08)] transition-[border-color,box-shadow] duration-150 ease-out outline-none hover:shadow-[0_4px_14px_hsl(var(--shadow)/0.1)] focus-visible:ring-2 data-[popup-open]:shadow-[0_4px_14px_hsl(var(--shadow)/0.1)]"
      >
        <OrgBadge name={org.name} className="size-[34px] rounded-md text-[14px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-[650] [font-family:var(--font-rounded)]">{org.name}</span>
          <span className="text-quiet block truncate text-[12px]">{me.email}</span>
        </span>
        <ChevronsUpDown className="text-quiet size-4 flex-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[min(296px,calc(100vw-1.5rem))] rounded-2xl p-0">
        {/* Organizations: every one signed in on this browser, and the page with all of them. */}
        <DropdownMenuGroup className="p-1.5">
          <div className="flex items-center justify-between pr-1">
            <DropdownMenuLabel className={LABEL}>Organizations</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigate({ to: '/organizations' })}
              className="text-brand focus:text-brand h-6 gap-0.5 rounded-md px-1.5 text-[12px] font-semibold focus:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] [&_svg]:size-3.5"
            >
              See all
              <ChevronRight />
            </DropdownMenuItem>
          </div>
          {orgs.map((other) => {
            const current = other.slug === org.slug
            return (
              <DropdownMenuItem
                key={other.slug}
                aria-current={current ? 'true' : undefined}
                // Another email's organization: the page loads again, with that organization's session.
                onClick={() => (current ? undefined : other.here ? navigate({ to: '/$org', params: { org: other.slug } }) : crossTo(`/${other.slug}`))}
                className="group gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150"
              >
                <OrgBadge name={other.name} className="size-8 rounded-sm text-[13px]" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', current && 'font-semibold')}>{other.name}</span>
                  <span className="text-quiet block truncate text-[12px]">{other.email}</span>
                </span>
                {current ? (
                  <span className="bg-brand text-on-brand grid size-[18px] flex-none place-items-center rounded-full">
                    <Check className="size-3!" strokeWidth={3} />
                  </span>
                ) : (
                  <ChevronRight className="text-quiet -translate-x-1 opacity-0 transition-[opacity,translate] duration-150 group-focus:translate-x-0 group-focus:opacity-100" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="mx-0 my-0" />
        <ThemeRow />
        <DropdownMenuSeparator className="mx-0 my-0" />

        <DropdownMenuGroup className="p-1.5">
          {ownGroupOrder && (
            <MenuAction icon={<ListRestart />} onClick={() => savePrefs.mutate({ group_order: [] })}>
              Use the team's order of groups
            </MenuAction>
          )}
          <MenuAction danger icon={<LogOut />} onClick={signOut}>
            Sign out of {org.name}
          </MenuAction>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const LABEL = 'text-quiet px-2 py-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase'

const THEMES: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
  { value: 'system', label: 'System', icon: <Monitor /> },
]

/**
 * How Teamshelf looks in this browser: yours, not the organization's. Three equal options on a
 * track, with a chip that slides to the chosen one. The new look spreads from the click.
 */
function ThemeRow() {
  const theme = useTheme()
  const index = THEMES.findIndex((option) => option.value === theme)
  return (
    <div className="px-1.5 pt-1.5 pb-2.5">
      <div className={LABEL}>Appearance</div>
      <div role="radiogroup" aria-label="Theme" className="bg-well relative mx-1 mt-0.5 grid grid-cols-3 rounded-md p-[3px]">
        <span
          aria-hidden="true"
          className="bg-chip absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-sm shadow-[0_1px_3px_hsl(var(--shadow)/0.16),0_0_0_1px_var(--line)] transition-transform duration-300 ease-[cubic-bezier(0.3,0.7,0.2,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {THEMES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            onClick={(event) => setThemeFrom(option.value, { x: event.clientX, y: event.clientY })}
            className="text-quiet hover:text-ink aria-checked:text-ink focus-visible:ring-brand/50 relative flex h-8 items-center justify-center gap-1.5 rounded-sm text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 [&_svg]:size-[15px]"
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** One of the menu's actions, with its icon. Signing out turns red under the pointer. */
function MenuAction({ icon, danger = false, onClick, children }: { icon: ReactNode; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className={cn(
        'text-ink/85 [&_svg]:text-quiet gap-2.5 rounded-md px-2 py-2 transition-colors duration-150 [&_svg]:transition-colors',
        danger && 'focus:text-danger focus:[&_svg]:text-danger focus:bg-[color-mix(in_srgb,var(--danger)_9%,transparent)]',
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </DropdownMenuItem>
  )
}
