import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useBoardLinksIfLoaded, useSetTeamLinkOrder } from '@/api/links'
import { useSaveBoardPrefs } from '@/api/prefs'
import { useSetSpaceCardSizes, useSetSpaceLayout } from '@/api/spaces'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import { mergeOrder } from '@/lib/order'
import type { BoardPrefs, CardSizes, Space } from '@/lib/types'
import { orderedLinks } from './board-model'
import { mergeLayout, type Layout } from './board-layout'
import { tidyHeight, tidyWidths } from './resize'
import { useRecordOpen } from '@/features/search/use-record-open'
import { useEffectiveBoardPrefs, useHasOwnOrder } from './use-board-prefs'

interface BoardActions {
  prefs: BoardPrefs
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
  /** How tall a card's list may grow before it scrolls (px), or undefined for the usual. */
  cardHeight: (groupId: string) => number | undefined
  /** Each column's share of the board's width, when they were set for this many columns. */
  columnWidths: (count: number) => number[] | undefined
  /** Whether this card has a size of its own that a reset would undo. */
  isResized: (groupId: string) => boolean
  /** Sets a card's height; undefined goes back to the usual (the space's, for people who aren't its admins). */
  resizeCard: (groupId: string, height: number | undefined) => void
  /** Sets the columns' widths; undefined makes them equal again (or the space's). */
  resizeColumns: (widths: number[] | undefined) => void
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
 * Hiding, reordering and resizing on the board of one space.
 *
 * Resizing is for everyone, like reordering by the space's admins: an admin's resize is the
 * space's, everyone else's is their own and wins over the space's for that card (or the columns).
 *
 * Hiding is always personal. Reordering depends on who drags: the space's admins change the
 * space's order, which everyone follows who hasn't made their own. Everyone else changes their
 * own order, of the groups or of the one group they dragged in.
 */
export function BoardActionsProvider({ space, canReorder, children }: { space: Space | null; canReorder: boolean; children: ReactNode }) {
  const ownOrder = useHasOwnOrder()
  const links = useBoardLinksIfLoaded()
  const prefs = useEffectiveBoardPrefs()
  const savePrefs = useSaveBoardPrefs()
  const setSpaceLayout = useSetSpaceLayout()
  const setTeamLinkOrder = useSetTeamLinkOrder()
  const recordOpen = useRecordOpen()
  const { isSpaceAdmin } = usePermissions()
  const spaceAdmin = isSpaceAdmin(space?.id)
  const setSpaceCardSizes = useSetSpaceCardSizes()
  const teamSizes: CardSizes = space?.card_sizes ?? {}
  // The space's admins see (and change) the space's sizes, never a size of their own.
  const ownSizes: CardSizes = (!spaceAdmin && space && prefs.card_sizes?.[space.id]) || {}
  const ownLayout = space ? prefs.group_layout[space.id] : undefined
  const layout = (ownOrder && ownLayout?.length ? ownLayout : space?.layout) ?? []

  const actions = useMemo<BoardActions>(() => {
    const save = (changes: Partial<BoardPrefs>) => savePrefs.mutate(changes, { onError: toastError })

    return {
      prefs,
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
      cardHeight: (groupId) => ownSizes.heights?.[groupId] ?? teamSizes.heights?.[groupId],
      columnWidths: (count) => {
        const widths = ownSizes.widths ?? teamSizes.widths
        return widths?.length === count ? widths : undefined
      },
      isResized: (groupId) => (spaceAdmin ? teamSizes : ownSizes).heights?.[groupId] !== undefined,
      resizeCard: (groupId, height) => {
        if (!space) return
        const sizes = spaceAdmin ? teamSizes : ownSizes
        const heights = height === undefined ? without(sizes.heights ?? {}, groupId) : { ...sizes.heights, [groupId]: tidyHeight(height) }
        const next: CardSizes = { ...sizes, heights }
        if (Object.keys(heights).length === 0) delete next.heights
        if (spaceAdmin) setSpaceCardSizes.mutate({ id: space.id, sizes: next }, { onError: toastError })
        else save({ card_sizes: { ...prefs.card_sizes, [space.id]: next } })
      },
      resizeColumns: (widths) => {
        if (!space) return
        const sizes = spaceAdmin ? teamSizes : ownSizes
        const next: CardSizes = { ...sizes, widths: widths && tidyWidths(widths) }
        if (!widths) delete next.widths
        if (spaceAdmin) setSpaceCardSizes.mutate({ id: space.id, sizes: next }, { onError: toastError })
        else save({ card_sizes: { ...prefs.card_sizes, [space.id]: next } })
      },
    }
    // The mutation objects change on every render, their `mutate` functions don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownOrder, links, prefs, canReorder, space, layout, spaceAdmin])

  return <BoardActionsContext value={actions}>{children}</BoardActionsContext>
}
