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
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { colorValue } from '@/lib/colors'
import { useBoardActions } from './board-actions'
import { arrangeColumns, columnOf, moveCard, sameLayout, type Layout } from './board-layout'
import { estimateCardHeight, rowsOf, type BoardCard } from './board-model'
import { GroupCard, SortableGroupCard } from './group-card'
import { LinkRow } from './link-row'
import { COLUMN_GAP, useColumnCount } from './masonry'

const onResize = (listener: () => void) => {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

/** The window's height, kept up to date. */
const useWindowHeight = () => useSyncExternalStore(onResize, () => window.innerHeight)

/** How tall the board's footer (the "New group" tile) is. */
const FOOTER_HEIGHT = 88

/** What is in your hand: a group, or a link (which only moves within its group). */
type Held = { type: 'group'; id: string } | { type: 'link'; id: string; groupId: string }

/**
 * A link is only dropped among the links of its own group, at the nearest row. A group is
 * dropped among groups and columns: on the card under the pointer, or in a column (so also
 * below its last card, or in an empty column).
 */
const sameKind: CollisionDetection = (args) => {
  const held = args.active.data.current as { type: string; groupId?: string }
  const candidates = args.droppableContainers.filter((container) => {
    const data = container.data.current as { type?: string; groupId?: string } | undefined
    if (held.type === 'link') return data?.type === 'link' && data.groupId === held.groupId
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
  const { arrangeGroups, reorderLinks, environments, layout } = useBoardActions()
  const container = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(container)
  const [held, setHeld] = useState<Held | null>(null)

  const byId = new Map(cards.map((card) => [card.group.id, card]))
  const arranged = arrangeColumns(
    cards.map((card) => ({ id: card.group.id, height: estimateCardHeight(card) })),
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
    const data = active.data.current as { type: 'group' | 'link'; groupId?: string }
    setHeld(data.type === 'group' ? { type: 'group', id: String(active.id) } : { type: 'link', id: String(active.id), groupId: data.groupId! })
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
    // Within a column the cards make room by themselves. Only a move to another column changes the columns.
    if (!to || from === -1 || to.column === from) return
    if (performance.now() - lastMove.current < 160) return
    lastMove.current = performance.now()
    setDragged(moveCard(columns, String(active.id), to.column, to.beforeId))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (held?.type === 'group') {
      let next = columns
      const to = target(over)
      const from = columnOf(columns, String(active.id))
      if (to && from !== -1 && to.column === from && to.beforeId && to.beforeId !== String(active.id)) {
        const column = columns[from]
        next = columns.map((ids, index) => (index === from ? arrayMove(column, column.indexOf(String(active.id)), column.indexOf(to.beforeId!)) : ids))
      }
      if (sameLayout(next, arranged)) setDragged(null)
      else {
        setDragged(next)
        arrangeGroups(next)
      }
    }
    if (held?.type === 'link' && over && over.id !== active.id) {
      // A line can hold several links (one per environment). The lines change places, and
      // the links of a line stay together, in their order.
      const card = shown(held.groupId)
      const rows = card ? rowsOf(card, environments) : []
      const from = rows.findIndex((row) => row.id === active.id)
      const to = rows.findIndex((row) => row.id === over.id)
      if (from !== -1 && to !== -1) {
        const next = arrayMove(rows, from, to).flatMap((row) => row.links.map(({ item }) => item.link.id))
        setLinkOrder({ scope: held.groupId, ids: next })
        reorderLinks(held.groupId, next)
      }
    }
    setHeld(null)
  }

  function onDragCancel() {
    setHeld(null)
    setDragged(null)
  }

  const heldCard = held?.type === 'group' ? shown(held.id) : undefined
  const heldRowCard = held?.type === 'link' ? shown(held.groupId) : undefined
  const heldRow = heldRowCard && rowsOf(heldRowCard, environments).find((row) => row.id === held?.id)

  // The footer (a new group) goes in the first column, from the left, where it still fits on
  // the screen without scrolling. When none has room, at the end of the shortest one.
  const heights = columns.map((ids) => ids.reduce((sum, id) => sum + (byId.has(id) ? estimateCardHeight(byId.get(id)!) + COLUMN_GAP : 0), 0))
  // The board starts under the top bar, about 100px down.
  const room = useWindowHeight() - 100 - 24
  const fitting = heights.findIndex((height) => height + FOOTER_HEIGHT <= room)
  const footerColumn = fitting !== -1 ? fitting : heights.indexOf(Math.min(...heights))

  return (
    <DndContext sensors={sensors} collisionDetection={sameKind} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div ref={container} className="flex items-start" style={{ gap: COLUMN_GAP }}>
        {columns.map((ids, index) => (
          <Column key={index} index={index} ids={ids} dragging={held?.type === 'group'}>
            {ids.map((id) => {
              const card = shown(id)
              return card && <SortableGroupCard key={id} card={card} restoring={restoring} />
            })}
            {footer && index === footerColumn && <div>{footer}</div>}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {heldCard && <GroupCard card={heldCard} restoring={restoring} lifted />}
        {heldRow && (
          <div className="room-lifted-row" style={{ '--c': colorValue(heldRowCard!.group.color) } as CSSProperties}>
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
function Column({ index, ids, dragging, children }: { index: number; ids: string[]; dragging: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${index}`, data: { type: 'column', column: index } })
  return (
    <SortableContext id={`column:${index}`} items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`board-column${dragging ? ' is-dragging' : ''}${isOver ? ' is-over' : ''}`} style={{ gap: COLUMN_GAP }}>
        {children}
      </div>
    </SortableContext>
  )
}
