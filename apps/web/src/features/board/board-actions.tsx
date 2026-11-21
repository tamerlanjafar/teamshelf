import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { useBoardLinksIfLoaded } from '@/api/links'
import { useSaveBoardPrefs } from '@/api/prefs'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import { mergeOrder } from '@/lib/order'
import type { BoardPrefs, CardSizes, Space } from '@/lib/types'
import { orderedLinks } from './board-model'
import { mergeLayout, type Layout } from './board-layout'
import { useLayoutEditor } from './layout-editor'
import { tidyHeight, tidyWidths } from './resize'
import { useRecordOpen } from '@/features/search/use-record-open'
import { useEffectiveBoardPrefs } from './use-board-prefs'

interface BoardActions {
  prefs: BoardPrefs
  /** The space's default layout is being edited: what is arranged goes into the draft, for everyone once saved. */
  editing: boolean
  /** Dragging is off in the view of what you hid: a place among the hidden isn't a place on the board. */
  canReorder: boolean
  /** The board's columns as this person sees them: their own, or the space's default (or its draft, while editing). */
  layout: Layout
  /** Saves where the cards on screen now stand, column by column. */
  arrangeGroups: (shown: Layout) => void
  /** Saves a new order of one group's links: the ids of its links on screen, as they now stand. */
  reorderLinks: (groupId: string, visibleIds: string[]) => void
  /** Puts one group's links in alphabetical order. While editing the default layout only. */
  sortLinksByName: (groupId: string) => void
  /** Remembers that this person opened a link, for "Opened lately" in the search. */
  recordOpen: (linkId: string) => void
  setGroupHidden: (groupId: string, hidden: boolean) => void
  /** Hides links for this person, or brings them back. Several at once for a line with more than one. */
  setLinksHidden: (linkIds: string[], hidden: boolean) => void
  /** Goes back to the default order of one group's links (while editing: to the order before the draft changed it). */
  useTeamLinkOrder: (groupId: string) => void
  /** How tall a card's list may grow before it scrolls (px), or undefined for the usual. */
  cardHeight: (groupId: string) => number | undefined
  /** Each column's share of the board's width, when they were set for this many columns. */
  columnWidths: (count: number) => number[] | undefined
  /** Whether this card has a size of its own that a reset would undo. */
  isResized: (groupId: string) => boolean
  /** Sets a card's height; undefined goes back to the default (while editing: to as tall as its links). */
  resizeCard: (groupId: string, height: number | undefined) => void
  /** Sets the columns' widths; undefined goes back to the default (while editing: to equal widths). */
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

/** Whether this browser was already told that arranging the board is for yourself only. */
const TOLD = 'teamshelf-own-layout-told'

/**
 * Hiding, reordering and resizing on the board of one space.
 *
 * Everyone arranges their own board: where the cards stand, the order of a group's links, the
 * sizes of cards and columns. It is kept in their preferences and wins over the space's default
 * layout, for them only, until they reset it (the top bar).
 *
 * The default is built by the space's admins in the layout editor (layout-editor.tsx). While it
 * is open, the same dragging and resizing changes its draft instead, and nothing of the admin's
 * own. Hiding is always personal, and is off while editing.
 */
export function BoardActionsProvider({ space, canReorder, children }: { space: Space | null; canReorder: boolean; children: ReactNode }) {
  const links = useBoardLinksIfLoaded()
  const prefs = useEffectiveBoardPrefs()
  const savePrefs = useSaveBoardPrefs()
  const recordOpen = useRecordOpen()
  const editor = useLayoutEditor()
  const { draft, change, start } = editor
  const admin = usePermissions().isSpaceAdmin(space?.id)
  const teamSizes: CardSizes = space?.card_sizes ?? {}
  const ownSizes: CardSizes = (space && prefs.card_sizes?.[space.id]) || {}
  const ownLayout = space ? prefs.group_layout[space.id] : undefined
  const layout = draft ? draft.layout : ((ownLayout?.length ? ownLayout : space?.layout) ?? [])

  const actions = useMemo<BoardActions>(() => {
    const save = (changes: Partial<BoardPrefs>) => {
      savePrefs.mutate(changes, { onError: toastError })
      tellOnce()
    }
    // The first time someone arranges their board on this browser: who sees it, and the way back.
    function tellOnce() {
      try {
        if (localStorage.getItem(TOLD)) return
        localStorage.setItem(TOLD, '1')
      } catch {
        return
      }
      toast('Only you see this change', {
        description: admin ? 'To change it for everyone, edit the default layout.' : 'Reset it anytime from the layout button, top right.',
        action: admin ? { label: 'Edit default layout', onClick: start } : undefined,
      })
    }
    /** A new set of sizes with one card's height set, or taken out. */
    const withHeight = (sizes: CardSizes, groupId: string, height: number | undefined): CardSizes => {
      const heights = height === undefined ? without(sizes.heights ?? {}, groupId) : { ...sizes.heights, [groupId]: tidyHeight(height) }
      const next: CardSizes = { ...sizes, heights }
      if (Object.keys(heights).length === 0) delete next.heights
      return next
    }
    const withWidths = (sizes: CardSizes, widths: number[] | undefined): CardSizes => {
      const next: CardSizes = { ...sizes, widths: widths && tidyWidths(widths) }
      if (!widths) delete next.widths
      return next
    }
    const allIds = (groupId: string) => orderedLinks(links, groupId, prefs).map((link) => link.id)

    return {
      prefs,
      editing: Boolean(draft),
      canReorder,
      layout,
      arrangeGroups: (shown) => {
        if (!space) return
        const next = mergeLayout(layout, shown)
        if (draft) change((current) => ({ ...current, layout: next }))
        else save({ group_layout: { ...prefs.group_layout, [space.id]: next } })
      },
      reorderLinks: (groupId, visibleIds) => {
        const ids = mergeOrder(allIds(groupId), visibleIds)
        if (draft) change((current) => ({ ...current, linkOrder: { ...current.linkOrder, [groupId]: ids } }))
        else save({ link_order: { ...prefs.link_order, [groupId]: ids } })
      },
      sortLinksByName: (groupId) => {
        const sorted = links.filter((link) => link.group_id === groupId).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }))
        change((current) => ({ ...current, linkOrder: { ...current.linkOrder, [groupId]: sorted.map((link) => link.id) } }))
      },
      recordOpen: (linkId) => space && recordOpen({ id: linkId, space_id: space.id }),
      setGroupHidden: (groupId, hidden) => savePrefs.mutate({ hidden_groups: toggled(prefs.hidden_groups, groupId, hidden) }, { onError: toastError }),
      setLinksHidden: (linkIds, hidden) =>
        savePrefs.mutate({ hidden_links: hidden ? [...new Set([...prefs.hidden_links, ...linkIds])] : prefs.hidden_links.filter((id) => !linkIds.includes(id)) }, { onError: toastError }),
      useTeamLinkOrder: (groupId) => {
        if (draft) change((current) => ({ ...current, linkOrder: without(current.linkOrder, groupId) }))
        else savePrefs.mutate({ link_order: without(prefs.link_order, groupId) }, { onError: toastError })
      },
      cardHeight: (groupId) => (draft ? draft.sizes.heights?.[groupId] : (ownSizes.heights?.[groupId] ?? teamSizes.heights?.[groupId])),
      columnWidths: (count) => {
        const widths = draft ? draft.sizes.widths : (ownSizes.widths ?? teamSizes.widths)
        return widths?.length === count ? widths : undefined
      },
      isResized: (groupId) => (draft ? draft.sizes : ownSizes).heights?.[groupId] !== undefined,
      resizeCard: (groupId, height) => {
        if (!space) return
        if (draft) change((current) => ({ ...current, sizes: withHeight(current.sizes, groupId, height) }))
        else save({ card_sizes: { ...prefs.card_sizes, [space.id]: withHeight(ownSizes, groupId, height) } })
      },
      resizeColumns: (widths) => {
        if (!space) return
        if (draft) change((current) => ({ ...current, sizes: withWidths(current.sizes, widths) }))
        else save({ card_sizes: { ...prefs.card_sizes, [space.id]: withWidths(ownSizes, widths) } })
      },
    }
    // The mutation objects change on every render, their `mutate` functions don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, prefs, canReorder, space, layout, draft, change, start, admin])

  return <BoardActionsContext value={actions}>{children}</BoardActionsContext>
}
