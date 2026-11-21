import { Building2, Check, FlaskConical, ChevronLeft, ChevronRight, ChevronUp, LayoutDashboard, LogIn, Mail, RotateCcw, Search, Settings, SquarePlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { applyScenario, SCENARIOS } from './fixtures'
import { ALL_SCREENS, openScreen } from './screens'
import { getState, subscribe, update, uuid } from './store'

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
]

/**
 * Mock mode's own controls, floating in the bottom right corner and never part of the app's
 * pages. The pill steps to the previous or next screen (also Alt+[ and Alt+]); its middle opens
 * a list of every screen to search and jump to. The list also changes Alex's role, opens the
 * sign-in link that would have been emailed, and starts the data over.
 */
export function Toolbar() {
  const state = useSyncExternalStore(subscribe, getState)
  const [open, setOpen] = useState(false)
  const here = useSyncExternalStore(watchAddress, address)
  const index = ALL_SCREENS.findIndex((screen) => screen.id === state.screen)
  // The screen on show: the one opened last while still at its address, else one listed at this
  // address (for the same situation if there is one). Anywhere else, the address itself.
  const opened = ALL_SCREENS[index]
  const shownAt = (screen: (typeof ALL_SCREENS)[number]) => screen.shownAt ?? screen.path
  const atHere = ALL_SCREENS.filter((screen) => shownAt(screen) === here)
  const current = opened && shownAt(opened) === here ? opened : (atHere.find((screen) => screen.scenario === state.scenario.id) ?? atHere[0])
  const from = current ? ALL_SCREENS.indexOf(current) : Math.max(index, 0)
  const step = (by: number) => openScreen(ALL_SCREENS[(from + by + ALL_SCREENS.length) % ALL_SCREENS.length].id)
  const pending = state.pendingLink

  // A click anywhere outside the toolbar closes the list.
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.code === 'BracketLeft') step(-1)
      else if (event.altKey && event.code === 'BracketRight') step(1)
      else if (event.key === 'Escape') setOpen(false)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div ref={root} className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-[1000] flex flex-col items-end gap-2 text-[13px]">
      {open && <Panel currentId={current?.id ?? null} onClose={() => setOpen(false)} />}
      <div className="bg-raised border-line relative flex h-12 items-center gap-1 overflow-hidden rounded-2xl border p-1 shadow-[0_10px_30px_hsl(var(--shadow)/0.16),0_1px_3px_hsl(var(--shadow)/0.08)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="All screens"
          className="hover:bg-ink/5 aria-expanded:bg-ink/6 flex h-full max-w-[280px] min-w-0 items-center gap-2.5 rounded-xl pr-2.5 pl-1.5 text-left transition-colors"
        >
          <span className="relative grid size-8 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-brand [&_svg]:size-4">
            <FlaskConical />
            {pending && <span aria-label="A sign-in link is waiting" className="bg-brand ring-raised absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-quiet block truncate text-[11px] leading-4 font-medium">
              {current ? `${current.group} · ${ALL_SCREENS.indexOf(current) + 1} of ${ALL_SCREENS.length}` : 'Not in the list'}
            </span>
            <span className={cn('block truncate text-[13px] leading-[18px] font-semibold', !current && 'font-mono text-[12px]')}>{current ? current.title : here}</span>
          </span>
          <ChevronUp className={cn('text-quiet size-4 flex-none transition-transform duration-200', !open && 'rotate-180')} />
        </button>
        <span aria-hidden="true" className="bg-line mx-0.5 h-6 w-px flex-none" />
        <PillButton label="Previous screen (Alt+[)" onClick={() => step(-1)}>
          <ChevronLeft />
        </PillButton>
        <PillButton label="Next screen (Alt+])" onClick={() => step(1)}>
          <ChevronRight />
        </PillButton>
        {/* Where this screen is in the list. */}
        <span aria-hidden="true" className="bg-brand/70 absolute bottom-0 left-0 h-[2px] transition-[width] duration-300" style={{ width: `${current ? ((ALL_SCREENS.indexOf(current) + 1) / ALL_SCREENS.length) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

/** The page's address, path and query, as the screens list them. */
const address = () => window.location.pathname + window.location.search

/** The app moves between pages without telling anyone outside it, so the address is checked often. */
function watchAddress(onChange: () => void) {
  const timer = window.setInterval(onChange, 400)
  window.addEventListener('popstate', onChange)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('popstate', onChange)
  }
}

function PillButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="text-quiet hover:text-ink hover:bg-ink/6 active:bg-ink/10 grid h-full w-9 flex-none place-items-center rounded-xl transition-colors [&_svg]:size-[18px]">
      {children}
    </button>
  )
}

const GROUP_ICONS: Record<string, ReactNode> = {
  'Signing in': <LogIn />,
  Organizations: <Building2 />,
  'Creating an organization': <SquarePlus />,
  Board: <LayoutDashboard />,
  'Organization pages': <Settings />,
}

const ROLE_SHORT: Record<Role, string> = { admin: 'Admin', member: 'Member' }

/**
 * Every screen, by flow, with a search on top. Each shows its address under
 * its name. Up and down move through the list, Enter opens the highlighted one.
 */
function Panel({ currentId, onClose }: { currentId: string | null; onClose: () => void }) {
  const state = useSyncExternalStore(subscribe, getState)
  const [query, setQuery] = useState('')
  const scenario = SCENARIOS.find((one) => one.id === state.scenario.id)
  const pending = state.pendingLink
  const list = useRef<HTMLDivElement>(null)

  const found = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return ALL_SCREENS.filter((screen) => words.every((word) => `${screen.title} ${screen.group} ${screen.shownAt ?? screen.path}`.toLowerCase().includes(word)))
  }, [query])
  const groups = [...new Set(found.map((screen) => screen.group))]
  // The highlighted row: the current screen at first, the first match once searching.
  const [active, setActive] = useState(() => Math.max(0, ALL_SCREENS.findIndex((screen) => screen.id === currentId)))
  const activeId = found[Math.min(active, found.length - 1)]?.id

  useEffect(() => {
    list.current?.querySelector(`[data-id="${activeId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const restart = (role: Role = state.scenario.role) => {
    applyScenario(state.scenario.id, role, state.screen)
    window.location.reload()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const by = event.key === 'ArrowDown' ? 1 : -1
      setActive((value) => (Math.min(value, found.length - 1) + by + found.length) % Math.max(found.length, 1))
    } else if (event.key === 'Escape') onClose()
  }

  return (
    <div role="dialog" aria-label="Screens" className="bg-raised border-line flex max-h-[min(600px,calc(100dvh-90px))] w-[360px] flex-col overflow-hidden rounded-2xl border shadow-[0_16px_40px_hsl(var(--shadow)/0.22)]">
      {pending && (
        <button type="button" onClick={openSignInLink} className="bg-brand text-on-brand flex items-center gap-2.5 px-3.5 py-2.5 text-left font-medium [&_svg]:size-4 [&_svg]:flex-none">
          <Mail />
          <span className="min-w-0 flex-1 truncate">Open the sign-in link for {pending.email}</span>
          <ChevronRight />
        </button>
      )}

      <form
        className="border-line flex items-center gap-2.5 border-b px-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (activeId) openScreen(activeId)
        }}
      >
        <Search className="text-quiet size-4 flex-none" />
        <input
          // A tool's own search, so it takes the focus at once.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Find a screen"
          aria-label="Find a screen"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[color:var(--quiet)]"
        />
        <kbd className="text-quiet border-line rounded-md border px-1.5 text-[11px] font-medium">esc</kbd>
      </form>

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {groups.length === 0 && <p className="text-quiet m-0 px-2 py-8 text-center">No screen matches “{query}”.</p>}
        {groups.map((group) => {
          const screens = found.filter((screen) => screen.group === group)
          return (
            <section key={group}>
              <h3 className="bg-raised text-quiet sticky top-0 z-10 m-0 flex items-center gap-2 px-2 pt-3 pb-1.5 text-[11.5px] font-semibold [&_svg]:size-3.5">
                {GROUP_ICONS[group]}
                <span className="flex-1">{group}</span>
                <span className="text-[11px] font-medium tabular-nums opacity-70">{screens.length}</span>
              </h3>
              <div className="flex flex-col gap-px">
                {screens.map((screen) => {
                  const here = screen.id === currentId
                  const highlighted = screen.id === activeId
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      data-id={screen.id}
                      aria-current={here ? 'true' : undefined}
                      onClick={() => openScreen(screen.id)}
                      onMouseMove={() => setActive(found.indexOf(screen))}
                      className={cn(
                        'relative flex w-full items-center gap-3 rounded-[10px] py-2 pr-2.5 pl-3 text-left transition-colors duration-100',
                        highlighted && 'bg-ink/6',
                        here && 'bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]',
                      )}
                    >
                      {here && <span aria-hidden="true" className="bg-brand absolute inset-y-2 left-0.5 w-[3px] rounded-full" />}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate leading-5', here ? 'font-semibold' : 'font-medium')}>{screen.title}</span>
                        <span className="text-quiet block truncate font-mono text-[11.5px] leading-4">{screen.shownAt ?? screen.path}</span>
                      </span>
                      {screen.role && <span className="bg-well text-quiet flex-none rounded-md px-1.5 py-0.5 text-[11px] font-medium">{ROLE_SHORT[screen.role]}</span>}
                      {here && <Check className="text-brand size-4 flex-none" />}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <div className="border-line bg-well/40 flex flex-col gap-2 border-t p-2.5">
        {scenario?.roles && (
          <div className="bg-well grid grid-cols-2 rounded-[10px] p-[3px]" role="radiogroup" aria-label="Alex's role in Northwind">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                role="radio"
                aria-checked={state.scenario.role === role.value}
                onClick={() => restart(role.value)}
                className={cn('h-7 rounded-[8px] text-[12px] font-medium transition-colors', state.scenario.role === role.value ? 'bg-chip text-ink shadow-[0_1px_2px_hsl(var(--shadow)/0.15)]' : 'text-quiet hover:text-ink')}
              >
                {role.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pl-1">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium">{scenario?.title}</span>
            <span className="text-quiet block truncate text-[11.5px]" title={scenario?.description}>
              {scenario?.description}
            </span>
          </span>
          <button type="button" title="Reset the data" aria-label="Reset the data" onClick={() => restart()} className={FOOT}>
            <RotateCcw />
          </button>
        </div>
      </div>
    </div>
  )
}

const FOOT = 'text-quiet hover:text-ink hover:bg-ink/6 grid size-7 place-items-center rounded-lg transition-colors [&_svg]:size-4'

/** Does what clicking the emailed link does: a new session for that email, then back to the app. */
function openSignInLink() {
  const pending = getState().pendingLink
  if (!pending) return
  update((draft) => {
    let user = draft.db.users.find((one) => one.email === pending.email)
    if (!user) {
      user = { id: uuid(), email: pending.email, name: '' }
      draft.db.users.push(user)
    }
    const token = `token-${user.id}-${uuid().slice(0, 8)}`
    draft.tokens[token] = user.id
    draft.sessions._new = token
    draft.pendingLink = null
  })
  window.location.assign(pending.callbackURL)
}
