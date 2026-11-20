import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'
import { useBoardActions } from './board-actions'
import { estimateCardHeight, rowsOf, type BoardCard } from './board-model'
import { GroupCard, SortableGroupCard } from './group-card'
import { LinkRow } from './link-row'
import { Masonry } from './masonry'

/** What is in your hand: a group, or a link (which only moves within its group). */
type Held = { type: 'group'; id: string } | { type: 'link'; id: string; groupId: string }

/**
 * A group is only dropped among groups, a link only among the links of its own group.
 * For groups the card under the pointer counts, for links the nearest row.
 */
const sameKind: CollisionDetection = (args) => {
  const held = args.active.data.current as { type: string; groupId?: string }
  const candidates = args.droppableContainers.filter((container) => {
    const data = container.data.current as { type?: string; groupId?: string } | undefined
    return data?.type === held.type && (held.type === 'group' || data.groupId === held.groupId)
  })
  return (held.type === 'group' ? pointerWithin : closestCenter)({ ...args, droppableContainers: candidates })
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
 * The board's cards in their columns, with dragging: a group by its header to another place
 * on the board, a link to another place in its group. What you hold follows the pointer and
 * the rest makes room. Nothing is saved until you let go.
 */
export function SortableBoard({ cards, categories, restoring }: { cards: BoardCard[]; categories: Category[]; restoring: boolean }) {
  const { reorderGroups, reorderLinks } = useBoardActions()
  const [held, setHeld] = useState<Held | null>(null)

  const savedGroupIds = cards.map((card) => card.group.id)
  const savedLinkIds = (groupId: string) => cards.find((card) => card.group.id === groupId)?.links.map((item) => item.link.id) ?? []

  // The order of the groups while one is being dragged, and until it is saved.
  const [groupOrder, setGroupOrder] = usePendingOrder<null>(() => savedGroupIds)
  // The order of one group's links after a drop, until it is saved.
  const [linkOrder, setLinkOrder] = usePendingOrder<string>(savedLinkIds)
  // Groups reflow as you drag over them. A short pause after each move keeps a card that
  // lands under the pointer from being swapped straight back.
  const lastGroupMove = useRef(0)

  const groupIds = groupOrder && groupOrder.ids.length === savedGroupIds.length ? groupOrder.ids : savedGroupIds
  const shown = groupIds
    .map((id) => cards.find((card) => card.group.id === id))
    .filter((card): card is BoardCard => Boolean(card))
    .map((card) => {
      if (linkOrder?.scope !== card.group.id) return card
      const byId = new Map(card.links.map((item) => [item.link.id, item]))
      const reordered = linkOrder.ids.map((id) => byId.get(id)).filter((item) => item !== undefined)
      return reordered.length === card.links.length ? { ...card, links: reordered } : card
    })

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a plain click still opens the link.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart({ active }: DragStartEvent) {
    const data = active.data.current as { type: 'group' | 'link'; groupId?: string }
    setHeld(data.type === 'group' ? { type: 'group', id: String(active.id) } : { type: 'link', id: String(active.id), groupId: data.groupId! })
    if (data.type === 'group') setGroupOrder({ scope: null, ids: groupIds })
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (held?.type !== 'group' || !over || over.id === active.id) return
    if (performance.now() - lastGroupMove.current < 220) return
    const from = groupIds.indexOf(String(active.id))
    const to = groupIds.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    lastGroupMove.current = performance.now()
    setGroupOrder({ scope: null, ids: arrayMove(groupIds, from, to) })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (held?.type === 'group') {
      if (sameOrder(groupIds, savedGroupIds)) setGroupOrder(null)
      else reorderGroups(groupIds)
    }
    if (held?.type === 'link' && over && over.id !== active.id) {
      // A line can hold several links (one per environment). The lines change places, and
      // the links of a line stay together, in their order.
      const card = shown.find((candidate) => candidate.group.id === held.groupId)
      const rows = card ? rowsOf(card) : []
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
    setGroupOrder(null)
  }

  const heldCard = held?.type === 'group' ? shown.find((card) => card.group.id === held.id) : undefined
  const heldRowCard = held?.type === 'link' ? shown.find((card) => card.group.id === held.groupId) : undefined
  const heldRow = heldRowCard && rowsOf(heldRowCard).find((row) => row.id === held?.id)

  return (
    <DndContext sensors={sensors} collisionDetection={sameKind} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      {/* No strategy: cards don't slide, the grid is laid out again with the new order. */}
      <SortableContext items={groupIds} strategy={() => null}>
        <Masonry items={shown} getKey={(card) => card.group.id} estimateHeight={estimateCardHeight} renderItem={(card) => <SortableGroupCard card={card} categories={categories} restoring={restoring} />} />
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {heldCard && <GroupCard card={heldCard} categories={categories} restoring={restoring} lifted />}
        {heldRow && (
          <div className="room-lifted-row" style={{ '--c': colorValue(heldRowCard!.group.color) } as CSSProperties}>
            <LinkRow row={heldRow} groupId={heldRowCard!.group.id} restoring={false} lifted />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
