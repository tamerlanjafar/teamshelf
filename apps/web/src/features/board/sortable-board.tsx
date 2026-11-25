import { MIN_COLUMN } from './resize'
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, type SortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { colorValue } from '@/lib/colors'
import { useBoardActions } from './board-actions'
import { arrangeColumns, columnOf, moveCard, sameLayout, type Layout } from './board-layout'
import { useMoveLinks } from '@/api/links'
import { toastError } from '@/lib/errors'
import { mergeOrder } from '@/lib/order'
import { estimateCardHeight, linkIdsIn, rowsOf, type BoardCard } from './board-model'
import { GroupCard, SortableGroupCard } from './group-card'
import { LinkRow } from './link-row'
import { COLUMN_GAP, useColumnCount } from './masonry'

const onResize = (listener: () => void) => {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

/** The window's height, kept up to date. */
// Cards are measured again whenever the columns change while one is dragged: moved to another
// column, the cards there are where they are now, not where they were when the drag started,
// so the space for the dragged card keeps its gap and nothing jumps.
/** Cards that don't move by themselves: the page already has them in order. */
const standStill: SortingStrategy = () => null

const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }

const useWindowHeight = () => useSyncExternalStore(onResize, () => window.innerHeight)

/** How tall the board's footer (the "New group" tile) is. */
const FOOTER_HEIGHT = 88

/** What is in your hand: a group, or a link (which only moves within its group). */
/** A card in your hand remembers the column it came from (`from`). */
type Held = { type: 'group'; id: string; from: number } | { type: 'link'; id: string; groupId: string; folderId: string | null }

/**
 * A link is only dropped among the links of its own group, at the nearest row. A group is
 * dropped among groups and columns: on the card under the pointer, or in a column (so also
 * below its last card, or in an empty column).
 */
const sameKind: CollisionDetection = (args) => {
  const held = args.active.data.current as { type: string; groupId?: string; folderId?: string | null; canMove?: boolean }
  // A link of an admin's space can go into another folder of its group: the innermost folder
  // under the pointer (its line, or all of it when open), or the card outside any folder (the
  // top of the group). Over its own folder, it is sorted among that folder's links as before.
  if (held.type === 'link' && held.canMove) {
    const areas = args.droppableContainers.filter((container) => {
      const data = container.data.current as { type?: string; groupId?: string } | undefined
      return data?.type === 'area' && data.groupId === held.groupId
    })
    const under = pointerWithin({ ...args, droppableContainers: areas })
    const area = (collision: (typeof under)[number]) => {
      const rect = args.droppableRects.get(collision.id)
      return rect ? rect.width * rect.height : Infinity
    }
    const innermost = [...under].sort((a, b) => area(a) - area(b))[0]
    const folderId = (innermost?.data?.droppableContainer.data.current as { folderId?: string | null } | undefined)?.folderId
    if (innermost && (folderId ?? null) !== (held.folderId ?? null)) return [innermost]
  }
  const candidates = args.droppableContainers.filter((container) => {
    const data = container.data.current as { type?: string; groupId?: string; folderId?: string | null } | undefined
    // A link stays in its folder: it is dropped among the links of the same folder only.
    if (held.type === 'link') return data?.type === 'link' && data.groupId === held.groupId && (data.folderId ?? null) === (held.folderId ?? null)
    return data?.type === 'group' || data?.type === 'column'
  })
  if (held.type === 'link') return closestCenter({ ...args, droppableContainers: candidates })
  const under = pointerWithin({ ...args, droppableContainers: candidates })
  // A card under the pointer wins over the column it is in.
  const card = under.find((collision) => (collision.data?.droppableContainer.data.current as { type?: string })?.type === 'group')
  if (card) return [card]
  if (under.length) return under
  return closestCorners({ ...args, droppableContainers: candidates })
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index])

/**
 * An order that was just made by dragging, shown at once while it is being saved. It stops
 * counting as soon as the saved data says the same, and is forgotten after a few seconds
 * either way (so a failed save falls back to what is really saved).
 */
function usePendingOrder<Scope>(saved: (scope: Scope) => string[]) {
  const [pending, setPending] = useState<{ scope: Scope; ids: string[] } | null>(null)

  useEffect(() => {
    if (!pending) return
    const forget = setTimeout(() => setPending(null), 4000)
    return () => clearTimeout(forget)
  }, [pending])

  const settled = pending !== null && sameOrder(saved(pending.scope), pending.ids)
  return [settled ? null : pending, setPending] as const
}

/**
 * The board's cards in their columns, with dragging: a group by its header to any column and
 * any place in it, a link to another place in its group. What you hold follows the pointer and
 * the rest makes room. Nothing is saved until you let go.
 */
export function SortableBoard({ cards, restoring, footer }: { cards: BoardCard[]; restoring: boolean; /** The last thing on the board, after the cards. */ footer?: ReactNode }) {
  const { arrangeGroups, reorderLinks, layout, cardHeight, columnWidths } = useBoardActions()
  const moveLinks = useMoveLinks()
  const container = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(container)
  const [held, setHeld] = useState<Held | null>(null)

  const byId = new Map(cards.map((card) => [card.group.id, card]))
  // A resized card is as tall as its header and the height it was given, at most.
  const heightOf = (card: BoardCard) => {
    const resized = cardHeight(card.group.id)
    return resized === undefined ? estimateCardHeight(card) : Math.min(estimateCardHeight(card, Infinity), 62 + resized)
  }
  const arranged = arrangeColumns(
    cards.map((card) => ({ id: card.group.id, height: heightOf(card) })),
    layout,
    columnCount,
    COLUMN_GAP,
  )
  // The columns while a card is being dragged, and until the new layout is saved.
  const [dragged, setDragged] = useState<Layout | null>(null)
  useEffect(() => {
    if (!dragged || held) return
    const forget = setTimeout(() => setDragged(null), 4000)
    return () => clearTimeout(forget)
  }, [dragged, held])
  // Once the saved layout says the same, the dragged one is no longer needed.
  const columns = dragged && dragged.length === arranged.length && (held || !sameLayout(dragged, arranged)) ? dragged : arranged

  const savedLinkIds = (groupId: string) => byId.get(groupId)?.links.map((item) => item.link.id) ?? []
  // The order of one group's links after a drop, until it is saved.
  const [linkOrder, setLinkOrder] = usePendingOrder<string>(savedLinkIds)
  // Moving a card between columns changes what is under the pointer. A short pause after each
  // move keeps it from being sent straight back.
  const lastMove = useRef(0)

  const shown = (id: string): BoardCard | undefined => {
    const card = byId.get(id)
    if (!card || linkOrder?.scope !== id) return card
    const items = new Map(card.links.map((item) => [item.link.id, item]))
    const reordered = linkOrder.ids.map((linkId) => items.get(linkId)).filter((item) => item !== undefined)
    return reordered.length === card.links.length ? { ...card, links: reordered } : card
  }

  const sensors = useSensors(
    // With a mouse: a few pixels of movement before a drag starts, so a plain click still opens the link.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // With a finger: press and hold. A swipe scrolls the page, as anywhere else.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart({ active }: DragStartEvent) {
    // A short buzz where the device has one, so a held finger knows the card is picked up.
    if (typeof navigator.vibrate === 'function') navigator.vibrate(12)
    const data = active.data.current as { type: 'group' | 'link'; groupId?: string; folderId?: string | null }
    setHeld(data.type === 'group' ? { type: 'group', id: String(active.id), from: columnOf(columns, String(active.id)) } : { type: 'link', id: String(active.id), groupId: data.groupId!, folderId: data.folderId ?? null })
    if (data.type === 'group') setDragged(columns)
  }

  /** The column and the card a group is over: a card, or a column (then: its end). */
  function target(over: DragOverEvent['over']): { column: number; beforeId: string | null } | null {
    if (!over) return null
    const data = over.data.current as { type?: string; column?: number } | undefined
    if (data?.type === 'column') return { column: data.column!, beforeId: null }
    const column = columnOf(columns, String(over.id))
    return column === -1 ? null : { column, beforeId: String(over.id) }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (held?.type !== 'group' || !over || over.id === active.id) return
    const to = target(over)
    const from = columnOf(columns, String(active.id))
    // In the column it came from, the cards make room by themselves (they slide). Anywhere else
    // the card is really moved there, also from place to place within that column, so the cards
    // stand where the page puts them, with their usual gaps.
    if (!to || from === -1 || (to.column === from && from === held.from)) return
    if (performance.now() - lastMove.current < 160) return
    lastMove.current = performance.now()
    if (to.column === from) {
      const column = columns[from]
      const at = to.beforeId === null ? column.length - 1 : column.indexOf(to.beforeId)
      if (at === -1 || at === column.indexOf(String(active.id))) return
      setDragged(columns.map((ids, index) => (index === from ? arrayMove(column, column.indexOf(String(active.id)), at) : ids)))
    } else setDragged(moveCard(columns, String(active.id), to.column, to.beforeId))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (held?.type === 'group') {
      let next = columns
      const to = target(over)
      const from = columnOf(columns, String(active.id))
      // Only the column it came from still has to be put in order: elsewhere it already is.
      if (to && from !== -1 && to.column === from && from === held.from && to.beforeId && to.beforeId !== String(active.id)) {
        const column = columns[from]
        next = columns.map((ids, index) => (index === from ? arrayMove(column, column.indexOf(String(active.id)), column.indexOf(to.beforeId!)) : ids))
      }
      if (sameLayout(next, arranged)) setDragged(null)
      else {
        setDragged(next)
        arrangeGroups(next)
      }
    }
    // Dropped into another folder (or the top of the group): it moves there, at the end.
    const area = over?.data.current as { type?: string; folderId?: string | null } | undefined
    if (held?.type === 'link' && area?.type === 'area' && (area.folderId ?? null) !== held.folderId) {
      const link = shown(held.groupId)?.links.find((item) => item.link.id === held.id)?.link
      if (link) moveLinks.mutate({ links: [link], folderId: area.folderId ?? null }, { onError: toastError })
    } else if (held?.type === 'link' && over && over.id !== active.id) {
      const card = shown(held.groupId)
      // The links of the folder it was moved in, in their new order. They take the places they
      // had among the group's links, and the rest stay where they were.
      const siblings = card ? linkIdsIn(card, held.folderId) : []
      const from = siblings.indexOf(String(active.id))
      const to = siblings.indexOf(String(over.id))
      if (card && from !== -1 && to !== -1) {
        const moved = arrayMove(siblings, from, to)
        setLinkOrder({ scope: held.groupId, ids: mergeOrder(rowsOf(card).map((row) => row.id), moved) })
        reorderLinks(held.groupId, moved)
      }
    }
    setHeld(null)
  }

  function onDragCancel() {
    setHeld(null)
    setDragged(null)
  }

  // The card in your hand is as wide as the column it would drop into, also after moving to a
  // column of another width, so dropping it doesn't snap it to a new size.
  const heldColumn = held?.type === 'group' ? columnOf(columns, held.id) : -1
  const [overlayWidth, setOverlayWidth] = useState<number>()
  useLayoutEffect(() => {
    const column = heldColumn === -1 ? null : container.current?.querySelectorAll<HTMLElement>('[data-column]')[heldColumn]
    setOverlayWidth(column ? column.getBoundingClientRect().width : undefined)
  }, [heldColumn, columns])

  const heldCard = held?.type === 'group' ? shown(held.id) : undefined
  const heldRowCard = held?.type === 'link' ? shown(held.groupId) : undefined
  const heldRow = heldRowCard && rowsOf(heldRowCard).find((row) => row.id === held?.id)

  // The footer (a new group) goes in the first column, from the left, where it still fits on
  // the screen without scrolling. When none has room, at the end of the shortest one.
  const heights = columns.map((ids) => ids.reduce((sum, id) => sum + (byId.has(id) ? heightOf(byId.get(id)!) + COLUMN_GAP : 0), 0))
  const widths = columnWidths(columns.length)
  // The board starts under the top bar, about 100px down.
  const room = useWindowHeight() - 100 - 24
  // An empty column narrowed to nothing is left out of the board (and its gap with it), also
  // while a card is dragged, so the columns keep their widths. Resetting the widths brings it back.
  const collapsed = (index: number) => widths?.[index] === 0 && !(arranged[index] ?? []).some((id) => byId.has(id))
  const open = heights.map((height, index) => (collapsed(index) ? Infinity : height))
  const fitting = open.findIndex((height) => height + FOOTER_HEIGHT <= room)
  const footerColumn = fitting !== -1 ? fitting : open.indexOf(Math.min(...open))

  return (
    <DndContext sensors={sensors} measuring={MEASURING} collisionDetection={sameKind} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div ref={container} className="flex items-start" style={{ gap: COLUMN_GAP }}>
        {columns.map((ids, index) => (
          <Column key={index} index={index} ids={ids} dragging={held?.type === 'group'} slides={held?.type !== 'group' || held.from === index} hidden={collapsed(index)} width={widths?.[index]}>
            {ids.map((id) => {
              const card = shown(id)
              return card && <SortableGroupCard key={id} card={card} restoring={restoring} resizable={{ left: index > 0, right: index < columns.length - 1 }} />
            })}
            {footer && index === footerColumn && <div>{footer}</div>}
          </Column>
        ))}
      </div>
      <DragOverlay style={overlayWidth ? { width: overlayWidth, height: 'auto' } : undefined} dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {heldCard && <GroupCard card={heldCard} restoring={restoring} lifted />}
        {heldRow && (
          // A line in your hand: a small card of its own.
          <div
            className="border-line bg-surface cursor-grabbing rounded-md border shadow-[0_2px_6px_hsl(var(--shadow)/0.1),0_18px_40px_-12px_hsl(var(--shadow)/0.35)]"
            style={{ '--c': colorValue(heldRowCard!.group.color) } as CSSProperties}>
            <LinkRow row={heldRow} groupId={heldRowCard!.group.id} restoring={false} lifted />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * One column of cards. While a card is being dragged, the whole column (also below its last
 * card, down to the bottom of the board) takes it, so it can be dropped at the end of any column.
 */
function Column({ index, ids, dragging, slides, hidden, width, children }: { index: number; ids: string[]; dragging: boolean; /** Its cards slide to make room (the column the card came from), or stand where they are. */ slides: boolean; hidden: boolean; /** Its share of the board's width, when the columns were resized. */ width?: number; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `column:${index}`, data: { type: 'column', column: index } })
  return (
    <SortableContext id={`column:${index}`} items={ids} strategy={slides ? verticalListSortingStrategy : standStill}>
      <div
        ref={setNodeRef}
        data-column
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          hidden && 'hidden',
          // While a card is dragged, every column reaches to the bottom of the board, so a card
          // can be dropped below the last one, or into an empty column.
          // Nothing is drawn there: the dashed space in the column shows where the card goes.
          dragging && 'min-h-[calc(100dvh-160px)] self-stretch',
        )}
        // A column narrowed to nothing while it was empty still opens up once a card is in it.
        style={{ gap: COLUMN_GAP, flexGrow: width, minWidth: ids.length > 0 ? MIN_COLUMN : undefined }}
      >
        {children}
      </div>
    </SortableContext>
  )
}
