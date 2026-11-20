import { ArrowDown, ArrowDownAZ, Eye, EyeOff, ListRestart, MoreHorizontal, Palette, Plus, Trash2 } from 'lucide-react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type Ref } from 'react'
import { useDeleteGroup } from '@/api/groups'
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/app/confirm-dialog'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { colorValue } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useBoardActions } from './board-actions'
import { rowsOf, type BoardCard } from './board-model'
import { GroupDialog } from './group-dialog'
import { LinkRow, SortableLinkRow } from './link-row'

interface GroupCardProps {
  card: BoardCard
  /** In the view of what you hid: a hidden group gets a button that brings it back. */
  restoring: boolean
}

/** What dragging adds to a card. */
interface CardDragProps {
  cardRef?: Ref<HTMLElement>
  /** Where the card is moving to while others are dragged past it. */
  dragStyle?: CSSProperties
  /** The card's place while it is being dragged: an empty slot on the board. */
  placeholder?: boolean
  /** The copy that follows the pointer. Its links are not sortable themselves. */
  lifted?: boolean
  /** The card is picked up by its header. */
  headProps?: ComponentProps<'header'>
}

/** A group and its links, tinted with the group's color. As tall as what is in it, up to a part of the screen. */
export function GroupCard({ card, restoring, cardRef, dragStyle, placeholder, lifted, headProps }: GroupCardProps & CardDragProps) {
  const { group, hidden } = card
  const { setGroupHidden, environments } = useBoardActions()
  const rows = rowsOf(card, environments)
  const Row = lifted ? LinkRow : SortableLinkRow
  // A card stops growing at a part of the screen and scrolls inside itself. Its edges fade
  // where lines are hidden above or below.
  const body = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false, below: 0 })
  const measureEdges = () => {
    const node = body.current
    if (!node) return
    const end = node.scrollTop + node.clientHeight
    // The lines that start below what is in view: what the "more" pill counts.
    const below = [...node.children].filter((child) => child instanceof HTMLElement && child.classList.contains('tab') && child.offsetTop + child.offsetHeight / 2 > end).length
    const next = { top: node.scrollTop > 2, bottom: end < node.scrollHeight - 2, below }
    setEdges((current) => (current.top === next.top && current.bottom === next.bottom && current.below === next.below ? current : next))
  }
  useLayoutEffect(() => {
    const node = body.current
    if (!node) return
    measureEdges()
    const observer = new ResizeObserver(measureEdges)
    observer.observe(node)
    return () => observer.disconnect()
  }, [rows.length])

  return (
    <section ref={cardRef} className={cn('room', placeholder && 'is-placeholder', lifted && 'is-lifted')} style={{ '--c': colorValue(group.color), ...dragStyle } as CSSProperties} aria-label={group.name}>
      <header className={cn('room-head', headProps && 'is-handle')} {...headProps}>
        <h2 className="room-name">{group.name}</h2>
        {restoring && hidden && <RestoreButton label={`Show ${group.name} again`} onClick={() => setGroupHidden(group.id, false)} />}
        <span className="count" aria-label={`${rows.length} ${rows.length === 1 ? 'link' : 'links'}`}>
          {rows.length}
        </span>
        <GroupMenu card={card} />
      </header>
      <div
        ref={body}
        className={cn('room-body', !lifted && 'is-capped', edges.top && 'fade-top', edges.bottom && 'fade-bottom')}
        onScroll={measureEdges}
        tabIndex={edges.bottom || edges.top ? 0 : undefined}
        aria-label={edges.bottom || edges.top ? `${group.name} links` : undefined}
      >
        {rows.length === 0 && <p className="room-empty">No links yet.</p>}
        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <Row key={row.id} row={row} groupId={group.id} restoring={restoring && !hidden} />
          ))}
        </SortableContext>
      </div>
      {!lifted && edges.bottom && edges.below > 0 && (
        <button type="button" className="room-more-below" onClick={() => body.current?.scrollBy({ top: body.current.clientHeight * 0.8, behavior: 'smooth' })} aria-label={`Scroll down: ${edges.below} more in ${group.name}`}>
          <ArrowDown className="size-3.5" />
          {edges.below} more
        </button>
      )}
    </section>
  )
}

/** A group card that can be dragged, by its header, to any column and any place in it. */
export function SortableGroupCard(props: GroupCardProps) {
  const { canReorder } = useBoardActions()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: props.card.group.id, data: { type: 'group' }, disabled: !canReorder })

  return (
    <GroupCard
      {...props}
      cardRef={setNodeRef}
      dragStyle={{ transform: CSS.Translate.toString(transform), transition }}
      placeholder={isDragging}
      headProps={canReorder ? { ...attributes, ...listeners, role: undefined, tabIndex: undefined } : undefined}
    />
  )
}

/** Hide the group for yourself, go back to the space's order, and for the space's admins: sort, edit and delete. */
function GroupMenu({ card }: { card: BoardCard }) {
  const { group, hidden, ownLinkOrder } = card
  const { isSpaceAdmin } = usePermissions()
  const admin = isSpaceAdmin(group.space_id)
  const { setGroupHidden, sortLinksByName, useTeamLinkOrder: resetLinkOrder } = useBoardActions()
  const { addLink } = useLinkDialog()
  const confirm = useConfirm()
  const deleteGroup = useDeleteGroup()
  const [editing, setEditing] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="room-button" aria-label={`More for ${group.name}`}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
          <DropdownMenuItem onClick={() => addLink(group.name)}>
            <Plus />
            {admin ? 'Add a link here…' : 'Suggest a link here…'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setGroupHidden(group.id, !hidden)}>
            {hidden ? <Eye /> : <EyeOff />}
            {hidden ? 'Show again' : 'Hide for me'}
          </DropdownMenuItem>
          {ownLinkOrder && (
            <DropdownMenuItem onClick={() => resetLinkOrder(group.id)}>
              <ListRestart />
              Use the space's order
            </DropdownMenuItem>
          )}
          {admin && (
            <>
              <DropdownMenuSeparator />
              {card.links.length > 1 && (
                <DropdownMenuItem onClick={() => sortLinksByName(group.id)}>
                  <ArrowDownAZ />
                  Sort links A to Z
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Palette />
                Name and color…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  confirm({
                    title: `Delete ${group.name}?`,
                    description: 'The group and every link in it are removed for everyone.',
                    confirmLabel: 'Delete group',
                    onConfirm: () => deleteGroup.mutate(group.id, { onError: toastError }),
                  })
                }
              >
                <Trash2 />
                Delete group…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {admin && <GroupDialog group={group} open={editing} onOpenChange={setEditing} />}
    </>
  )
}

/** In the view of what you hid: brings the group or link back to the board. */
export function RestoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="restore">
      <Eye className="size-3.5" />
      Show
    </button>
  )
}
