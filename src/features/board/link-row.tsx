import { Copy, Eye, EyeOff, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteLink } from '@/api/links'
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/app/confirm-dialog'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Category, Link } from '@/lib/types'
import { cn } from '@/lib/utils'
import { inLowerHalf, useBoardActions } from './board-actions'
import type { BoardLink } from './board-model'
import { CategoryTag } from './category-tag'
import { Favicon } from './favicon'

/**
 * One link on a card. The whole line opens it. Drag it to another place in its group.
 * With `restoring` (the view of what you hid) a hidden link gets an eye button that brings it back.
 */
export function LinkRow({ item, category, restoring }: { item: BoardLink; category: Category | undefined; restoring: boolean }) {
  const { link, hidden } = item
  const { canReorder, dragged, dropPlace, startDrag, setDropPlace, finishDrag, setLinkHidden } = useBoardActions()

  // Only a link of the same group can be dropped here.
  const accepts = dragged?.kind === 'link' && dragged.groupId === link.group_id && dragged.id !== link.id
  const marker = dropPlace?.id === link.id && accepts ? (dropPlace.after ? 'drop-after' : 'drop-before') : null

  return (
    <div
      className={cn('tab', dragged?.id === link.id && 'is-dragged', marker)}
      draggable={canReorder}
      onDragStart={(event) => {
        event.stopPropagation()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/uri-list', link.url)
        event.dataTransfer.setData('text/plain', link.url)
        startDrag({ kind: 'link', id: link.id, groupId: link.group_id! })
      }}
      onDragOver={(event) => {
        if (!accepts) return
        event.preventDefault()
        event.stopPropagation()
        setDropPlace({ id: link.id, after: inLowerHalf(event) })
      }}
      onDrop={(event) => {
        if (!accepts) return
        event.preventDefault()
        event.stopPropagation()
        finishDrag(true)
      }}
      onDragEnd={() => finishDrag(false)}
    >
      <a className="open" href={link.url} target="_blank" rel="noreferrer" title={link.url} draggable={false}>
        <Favicon url={link.url} title={link.title} />
        <span className="title">{link.title}</span>
        {link.visibility !== 'everyone' && <Lock className="text-quiet size-3 flex-none" aria-label="Only some people see this" />}
        {category && <CategoryTag category={category} />}
      </a>
      {restoring && hidden ? (
        // In the view of what you hid, the one thing to do with a link is to bring it back:
        // an eye where the menu usually is, so the name keeps its room.
        <button type="button" className="room-button shown" aria-label={`Show ${link.title} again`} title="Show again" onClick={() => setLinkHidden(link.id, false)}>
          <Eye className="size-4" />
        </button>
      ) : (
        <RowMenu link={link} hidden={hidden} />
      )}
    </div>
  )
}

/** Copy the address, hide the link for yourself, and for whoever manages the link: edit and delete. */
function RowMenu({ link, hidden }: { link: Link; hidden: boolean }) {
  const { canManage } = usePermissions()
  const { setLinkHidden } = useBoardActions()
  const { editLink } = useLinkDialog()
  const confirm = useConfirm()
  const deleteLink = useDeleteLink()

  const copy = () =>
    navigator.clipboard.writeText(link.url).then(
      () => toast.success('Address copied.'),
      () => toast.error("The address couldn't be copied."),
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="room-button" aria-label={`More for ${link.title}`}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        <DropdownMenuItem onClick={copy}>
          <Copy />
          Copy address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLinkHidden(link.id, !hidden)}>
          {hidden ? <Eye /> : <EyeOff />}
          {hidden ? 'Show again' : 'Hide for me'}
        </DropdownMenuItem>
        {canManage(link) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editLink(link)}>
              <Pencil />
              Edit…
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirm({
                  title: `Delete ${link.title}?`,
                  description: 'The link is removed from the board for everyone.',
                  confirmLabel: 'Delete link',
                  onConfirm: () => deleteLink.mutate(link.id, { onError: toastError }),
                })
              }
            >
              <Trash2 />
              Delete…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
