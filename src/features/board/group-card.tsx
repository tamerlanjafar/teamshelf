import { Eye, EyeOff, ListRestart, MoreHorizontal, Palette, Plus, Trash2 } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
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
import { inLowerHalf, useBoardActions } from './board-actions'
import type { BoardCard } from './board-model'
import { GroupDialog } from './group-dialog'
import { LinkRow } from './link-row'

/**
 * A group and its links, tinted with the group's color. As tall as what is in it.
 * Drag the card to another place on the board. With `restoring` (the view of what you hid)
 * a hidden group gets a button that brings it back.
 */
export function GroupCard({ card, categories, restoring }: { card: BoardCard; categories: Category[]; restoring: boolean }) {
  const { group, links, hidden } = card
  const { canReorder, dragged, dropPlace, startDrag, setDropPlace, finishDrag, setGroupHidden } = useBoardActions()

  const accepts = dragged?.kind === 'group' && dragged.id !== group.id
  const marker = dropPlace?.id === group.id && accepts ? (dropPlace.after ? 'drop-after' : 'drop-before') : null

  return (
    <section
      className={cn('room', dragged?.id === group.id && 'is-dragged', marker)}
      style={{ '--c': colorValue(group.color) } as CSSProperties}
      aria-label={group.name}
      draggable={canReorder}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', group.name)
        startDrag({ kind: 'group', id: group.id })
      }}
      onDragOver={(event) => {
        if (!accepts) return
        event.preventDefault()
        setDropPlace({ id: group.id, after: inLowerHalf(event) })
      }}
      onDrop={(event) => {
        if (!accepts) return
        event.preventDefault()
        finishDrag(true)
      }}
      onDragEnd={() => finishDrag(false)}
    >
      <header className="room-head">
        <h2 className="room-name">{group.name}</h2>
        {restoring && hidden && <RestoreButton label={`Show ${group.name} again`} onClick={() => setGroupHidden(group.id, false)} />}
        <span className="count" aria-label={`${links.length} ${links.length === 1 ? 'link' : 'links'}`}>
          {links.length}
        </span>
        <GroupMenu card={card} />
      </header>
      <div className="room-body">
        {links.length === 0 && <p className="room-empty">No links yet.</p>}
        {links.map((item) => (
          <LinkRow key={item.link.id} item={item} category={categories.find((category) => category.id === item.link.category_id)} restoring={restoring && !hidden} />
        ))}
      </div>
    </section>
  )
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
