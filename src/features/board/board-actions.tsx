import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useBoardLinksIfLoaded, useSetTeamLinkOrder } from '@/api/links'
import { useSaveBoardPrefs } from '@/api/prefs'
import { useSetSpaceLayout } from '@/api/spaces'
import { toastError } from '@/lib/errors'
import { mergeOrder } from '@/lib/order'
import type { BoardPrefs, Space } from '@/lib/types'
import { orderedLinks } from './board-model'
import { mergeLayout, type Layout } from './board-layout'
import { useRecordOpen } from '@/features/search/use-record-open'
import { useEffectiveBoardPrefs, useHasOwnOrder } from './use-board-prefs'

interface BoardActions {
  prefs: BoardPrefs
  /** The open space's environments, in the order a line shows them. */
  environments: string[]
  /** Dragging is off while the board is filtered: a place among some of the links isn't a place among all. */
  canReorder: boolean
  /** The board's columns as this person sees them: their own, or the space's. */
  layout: Layout
  /** Saves where the cards on screen now stand, column by column. */
  arrangeGroups: (shown: Layout) => void
  /** Saves a new order of one group's links: the ids of its links on screen, as they now stand. */
  reorderLinks: (groupId: string, visibleIds: string[]) => void
  /** Puts one group's links in alphabetical order, for everyone. The space's admins. */
  sortLinksByName: (groupId: string) => void
  /** Remembers that this person opened a link, for "Opened lately" in the search. */
  recordOpen: (linkId: string) => void
  setGroupHidden: (groupId: string, hidden: boolean) => void
  /** Hides links for this person, or brings them back. Several at once for a line with more than one. */
  setLinksHidden: (linkIds: string[], hidden: boolean) => void
  /** Go back to the space's layout, or to its order of one group's links. */
  useTeamGroupOrder: () => void
  useTeamLinkOrder: (groupId: string) => void
}

const BoardActionsContext = createContext<BoardActions | null>(null)

export function useBoardActions() {
  const actions = useContext(BoardActionsContext)
  if (!actions) throw new Error('useBoardActions needs a BoardActionsProvider above it.')
  return actions
}

const toggled = (ids: string[], id: string, on: boolean) => (on ? [...new Set([...ids, id])] : ids.filter((other) => other !== id))
const without = <Value,>(record: Record<string, Value>, key: string) => Object.fromEntries(Object.entries(record).filter(([other]) => other !== key))

/**
 * Hiding and reordering on the board of one space.
 *
 * Hiding is always personal. Reordering depends on who drags: the space's admins change the
 * space's order, which everyone follows who hasn't made their own. With personal ordering
 * switched on (see lib/features.ts) everyone else changes their own order, of the groups or
 * of the one group they dragged in. With it off, only the space's admins can drag.
 */
export function BoardActionsProvider({ space, canReorder, children }: { space: Space | null; canReorder: boolean; children: ReactNode }) {
  const ownOrder = useHasOwnOrder()
  const links = useBoardLinksIfLoaded()
  const prefs = useEffectiveBoardPrefs()
  const savePrefs = useSaveBoardPrefs()
  const setSpaceLayout = useSetSpaceLayout()
  const setTeamLinkOrder = useSetTeamLinkOrder()
  const recordOpen = useRecordOpen()
  const ownLayout = space ? prefs.group_layout[space.id] : undefined
  const layout = (ownOrder && ownLayout?.length ? ownLayout : space?.layout) ?? []

  const actions = useMemo<BoardActions>(() => {
    const save = (changes: Partial<BoardPrefs>) => savePrefs.mutate(changes, { onError: toastError })

    return {
      prefs,
      environments: space?.environments ?? [],
      canReorder,
      layout,
      arrangeGroups: (shown) => {
        if (!space) return
        const next = mergeLayout(layout, shown)
        if (ownOrder) save({ group_layout: { ...prefs.group_layout, [space.id]: next } })
        else setSpaceLayout.mutate({ id: space.id, layout: next }, { onError: toastError })
      },
      reorderLinks: (groupId, visibleIds) => {
        const ids = mergeOrder(orderedLinks(links, groupId, prefs).map((link) => link.id), visibleIds)
        if (ownOrder) save({ link_order: { ...prefs.link_order, [groupId]: ids } })
        else setTeamLinkOrder.mutate({ groupId, ids }, { onError: toastError })
      },
      sortLinksByName: (groupId) => {
        const sorted = links.filter((link) => link.group_id === groupId).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }))
        setTeamLinkOrder.mutate({ groupId, ids: sorted.map((link) => link.id) }, { onError: toastError })
        // The sorted order is everyone's, so a sorter's own order of this group stops hiding it.
        if (prefs.link_order[groupId]) save({ link_order: without(prefs.link_order, groupId) })
      },
      recordOpen: (linkId) => space && recordOpen({ id: linkId, space_id: space.id }),
      setGroupHidden: (groupId, hidden) => save({ hidden_groups: toggled(prefs.hidden_groups, groupId, hidden) }),
      setLinksHidden: (linkIds, hidden) => save({ hidden_links: hidden ? [...new Set([...prefs.hidden_links, ...linkIds])] : prefs.hidden_links.filter((id) => !linkIds.includes(id)) }),
      useTeamGroupOrder: () => space && save({ group_order: [], group_layout: without(prefs.group_layout, space.id) }),
      useTeamLinkOrder: (groupId) => save({ link_order: without(prefs.link_order, groupId) }),
    }
    // The mutation objects change on every render, their `mutate` functions don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownOrder, links, prefs, canReorder, space, layout])

  return <BoardActionsContext value={actions}>{children}</BoardActionsContext>
}
