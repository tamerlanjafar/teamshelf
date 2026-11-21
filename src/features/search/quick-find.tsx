import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { groupsOf, useGroupsIfLoaded } from '@/api/groups'
import { useBoardLinksIfLoaded } from '@/api/links'
import { useBoardPrefsIfLoaded } from '@/api/prefs'
import { openLink } from '@/features/board/open-link'
import { useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { colorValue } from '@/lib/colors'
import { withoutGroupName } from '@/lib/names'
import type { Group, Link } from '@/lib/types'
import { Kbd } from '@/components/app/kbd'
import { LinkOption, MenuKeys, MenuLabel, type LinkChoice } from './link-option'
import { useRecordOpen } from './use-record-open'

/** The most results the list shows, so it stays quick. Typing more finds the rest. */
const MAX_RESULTS = 50

type Found = LinkChoice & { haystack: string }

/** How a link reads in the list, and the text it is found by. */
function choiceOf(link: Link, group: Group): Found {
  const title = withoutGroupName(link.title, group.name)
  return {
    link,
    title,
    groupName: group.name,
    color: colorValue(group.color),
    haystack: `${group.name} ${link.title} ${link.kind === 'file' ? (link.file_name ?? '') : link.url}`.toLowerCase(),
  }
}

/** Better matches first: the name starting with the search, then the name containing it, then the rest. */
function rank(choice: LinkChoice, query: string) {
  const title = choice.title.toLowerCase()
  return title.startsWith(query) ? 0 : title.includes(query) ? 1 : `${choice.groupName} ${title}`.toLowerCase().includes(query) ? 2 : 3
}

/**
 * The search at the top of a space's board. It doesn't filter the board: it finds a link and
 * opens it. Clicking into it (or "/", or ⌘K) shows the links opened lately; typing searches every
 * link and file of the space, by name, group and address. Arrow keys choose, Enter opens.
 */
export function QuickFind() {
  const space = useCurrentSpaceIfLoaded()
  const groups = useGroupsIfLoaded()
  const links = useBoardLinksIfLoaded()
  const prefs = useBoardPrefsIfLoaded()
  const recordOpen = useRecordOpen()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // "/" or ⌘K (Ctrl+K) from anywhere outside a text field or a dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      const covered = Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'))
      const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
      const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey
      if ((commandK || slash) && !covered) {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
        setActive(0)
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Every link of the open space this person can see.
  const all = useMemo(() => {
    if (!space) return []
    const groupById = new Map(groupsOf(groups, space.id).map((group) => [group.id, group]))
    return links.flatMap((link) => {
      const group = link.space_id === space.id && link.group_id ? groupById.get(link.group_id) : undefined
      return group ? [choiceOf(link, group)] : []
    })
  }, [groups, links, space])

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const recent = space ? (prefs.recent_links[space.id] ?? []).flatMap((id) => all.filter((choice) => choice.link.id === id)) : []
  const matches = searching
    ? all.filter((choice) => words.every((word) => choice.haystack.includes(word))).sort((a, b) => rank(a, words.join(' ')) - rank(b, words.join(' ')) || a.title.localeCompare(b.title))
    : recent
  const shown = matches.slice(0, MAX_RESULTS)
  const chosen = Math.min(active, shown.length - 1)
  // Empty and nothing opened yet: nothing to show until something is typed.
  const showing = open && (searching || shown.length > 0)

  // The chosen line stays in view while moving through a long list.
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [chosen])

  function choose(choice: LinkChoice) {
    setOpen(false)
    setQuery('')
    input.current?.blur()
    recordOpen(choice.link)
    openLink(choice.link)
  }

  return (
    <div className="relative flex w-full min-w-0 flex-1 items-center">
      <Search className="text-quiet pointer-events-none absolute left-3.5 size-4" />
      <input
        ref={input}
        type="search"
        value={query}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search links…"
        aria-label="Search links"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-activedescendant={showing && shown.length ? `${listId}-${chosen}` : undefined}
        onFocus={() => {
          setActive(0)
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && shown.length) {
            event.preventDefault()
            if (!showing) return setOpen(true)
            setActive((chosen + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
          }
          if (event.key === 'Enter' && showing && shown[chosen]) {
            event.preventDefault()
            choose(shown[chosen])
          }
          if (event.key === 'Escape') {
            if (query) setQuery('')
            else {
              setOpen(false)
              input.current?.blur()
            }
          }
        }}
        className="peer bg-surface border-line placeholder:text-quiet focus:border-brand h-10 w-full min-w-0 rounded-lg border pr-[72px] pl-10 text-[15px] text-ellipsis outline-none max-sm:pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {/* The shortcut, while the field isn't in use, and an arrow that says (and toggles) the list. */}
      <span className="absolute right-1.5 flex items-center gap-1">
        <Kbd keyName="slash" className="pointer-events-none max-sm:hidden [.peer:focus~span_&]:hidden" />
        <button
          type="button"
          tabIndex={-1}
          aria-label={showing ? 'Close the list' : 'Show recent links'}
          onPointerDown={(event) => {
            event.preventDefault()
            if (showing) {
              setOpen(false)
              input.current?.blur()
            } else {
              input.current?.focus()
              setActive(0)
              setOpen(true)
            }
          }}
          className="text-quiet hover:text-ink hover:bg-ink/5 grid size-7 place-items-center rounded-lg transition-colors"
        >
          <ChevronDown className={cn('size-4 transition-transform', showing && 'rotate-180')} />
        </button>
      </span>

      {showing && (
        <div
          className="bg-raised border-line absolute top-[calc(100%+6px)] right-0 left-0 z-40 overflow-hidden rounded-xl border p-1 shadow-[0_20px_40px_-18px_hsl(var(--shadow)/0.45),0_2px_6px_-2px_hsl(var(--shadow)/0.1)]"
          // Clicking inside keeps the field focused, so the list doesn't close before the click lands.
          onPointerDown={(event) => event.preventDefault()}
        >
          {shown.length > 0 ? (
            <>
              <MenuLabel>{searching ? `${matches.length} ${matches.length === 1 ? 'link' : 'links'}${matches.length > MAX_RESULTS ? `, first ${MAX_RESULTS}` : ''}` : 'Recent'}</MenuLabel>
              <ul ref={list} id={listId} role="listbox" aria-label={searching ? 'Links found' : 'Recent links'} className="m-0 grid max-h-[min(60dvh,420px)] list-none gap-0.5 overflow-y-auto p-0">
                {shown.map((choice, index) => (
                  <LinkOption key={choice.link.id} id={`${listId}-${index}`} choice={choice} selected={index === chosen} onHover={() => setActive(index)} onChoose={() => choose(choice)} />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-quiet m-0 px-3 py-5 text-center text-[13.5px]">Nothing in {space?.name ?? 'this space'} has “{query.trim()}” in its name, group or address.</p>
          )}
          <MenuKeys className="-mx-1 mt-1 -mb-1" />
        </div>
      )}
    </div>
  )
}
