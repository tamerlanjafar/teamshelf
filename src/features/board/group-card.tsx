import { Eye, EyeOff, ListRestart, MoreHorizontal, Palette, Plus, Trash2 } from 'lucide-react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, type ComponentProps, type CSSProperties, type Ref } from 'react'
import { useDeleteGroup } from '@/api/groups'
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/app/confirm-dialog'
import { useLinkDialog } from '@/features/links/link-dialog'
import { useMe } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { colorValue } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import { isSuperAdmin } from '@/lib/roles'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBoardActions } from './board-actions'
import type { BoardCard, BoardLink } from './board-model'
import { GroupDialog } from './group-dialog'
import { LinkRow, SortableLinkRow } from './link-row'

interface GroupCardProps {
  card: BoardCard
  categories: Category[]
  /** In the view of what you hid: a hidden group gets a button that brings it back. */
  restoring: boolean
}

/** What dragging adds to a card. */
interface CardDragProps {
  cardRef?: Ref<HTMLElement>
  /** The card's place while it is being dragged: an empty slot on the board. */
  placeholder?: boolean
  /** The copy that follows the pointer. Its links are not sortable themselves. */
  lifted?: boolean
  /** The card is picked up by its header. */
  headProps?: ComponentProps<'header'>
}

/** A group and its links, tinted with the group's color. As tall as what is in it. */
export function GroupCard({ card, categories, restoring, cardRef, placeholder, lifted, headProps }: GroupCardProps & CardDragProps) {
  const { group, links, hidden } = card
  const { setGroupHidden } = useBoardActions()
  const categoryOf = (item: BoardLink) => categories.find((category) => category.id === item.link.category_id)
  const Row = lifted ? LinkRow : SortableLinkRow

  return (
    <section ref={cardRef} className={cn('room', placeholder && 'is-placeholder', lifted && 'is-lifted')} style={{ '--c': colorValue(group.color) } as CSSProperties} aria-label={group.name}>
      <header className={cn('room-head', headProps && 'is-handle')} {...headProps}>
        <h2 className="room-name">{group.name}</h2>
        {restoring && hidden && <RestoreButton label={`Show ${group.name} again`} onClick={() => setGroupHidden(group.id, false)} />}
        <span className="count" aria-label={`${links.length} ${links.length === 1 ? 'link' : 'links'}`}>
          {links.length}
        </span>
        <GroupMenu card={card} />
      </header>
      <div className="room-body">
        {links.length === 0 && <p className="room-empty">No links yet.</p>}
        <SortableContext items={links.map((item) => item.link.id)} strategy={verticalListSortingStrategy}>
          {links.map((item) => (
            <Row key={item.link.id} item={item} category={categoryOf(item)} restoring={restoring && !hidden} />
          ))}
        </SortableContext>
      </div>
    </section>
  )
}

/** A group card that can be dragged, by its header, to another place on the board. */
export function SortableGroupCard(props: GroupCardProps) {
  const { canReorder } = useBoardActions()
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id: props.card.group.id, data: { type: 'group' }, disabled: !canReorder })

  return <GroupCard {...props} cardRef={setNodeRef} placeholder={isDragging} headProps={canReorder ? { ...attributes, ...listeners, role: undefined, tabIndex: undefined } : undefined} />
}

/** Hide the group for yourself, go back to the team's order, and for the super admin: edit and delete. */
function GroupMenu({ card }: { card: BoardCard }) {
  const { group, hidden, ownLinkOrder } = card
  const me = useMe()
  const { reviewer } = usePermissions()
  const { setGroupHidden, useTeamLinkOrder: resetLinkOrder } = useBoardActions()
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
            {reviewer ? 'Add a link here…' : 'Suggest a link here…'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setGroupHidden(group.id, !hidden)}>
            {hidden ? <Eye /> : <EyeOff />}
            {hidden ? 'Show again' : 'Hide for me'}
          </DropdownMenuItem>
          {ownLinkOrder && (
            <DropdownMenuItem onClick={() => resetLinkOrder(group.id)}>
              <ListRestart />
              Use the team's order
            </DropdownMenuItem>
          )}
          {isSuperAdmin(me) && (
            <>
              <DropdownMenuSeparator />
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
      {isSuperAdmin(me) && <GroupDialog group={group} open={editing} onOpenChange={setEditing} />}
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
