import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Eye, EyeOff, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ComponentProps, CSSProperties, Ref } from 'react'
import { toast } from 'sonner'
import { useDeleteLink } from '@/api/links'
import { useConfirm } from '@/components/app/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Category, Link } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBoardActions } from './board-actions'
import type { BoardLink } from './board-model'
import { CategoryTag } from './category-tag'
import { Favicon } from './favicon'

interface LinkRowProps {
  item: BoardLink
  category: Category | undefined
  /** In the view of what you hid: a hidden link gets an eye button that brings it back. */
  restoring: boolean
}

/** What dragging adds to a row: where it is, how it moves, and whether it is the one in your hand. */
interface RowDragProps {
  rowRef?: Ref<HTMLDivElement>
  style?: CSSProperties
  /** The row's place while it is being dragged: an empty slot in the list. */
  placeholder?: boolean
  /** The copy that follows the pointer. */
  lifted?: boolean
  dragProps?: ComponentProps<'div'>
}

/** One link on a card. The whole line opens it. */
export function LinkRow({ item, category, restoring, rowRef, style, placeholder, lifted, dragProps }: LinkRowProps & RowDragProps) {
  const { link, hidden } = item
  const { setLinkHidden } = useBoardActions()

  return (
    <div ref={rowRef} style={style} className={cn('tab', placeholder && 'is-placeholder', lifted && 'is-lifted')} {...dragProps}>
      <a className="open" href={link.url} target="_blank" rel="noreferrer" draggable={false}>
        <Favicon url={link.url} iconUrl={link.icon_url} title={link.title} />
        <span className="title">{link.title}</span>
        {link.visibility !== 'everyone' && <Lock className="text-quiet size-3 flex-none" aria-label="Only some people see this" />}
        {category && <CategoryTag category={category} />}
      </a>
      {restoring && hidden ? (
        // In the view of what you hid, the one thing to do with a link is to bring it back:
        // an eye where the menu usually is, so the name keeps its room.
        <button type="button" className="room-button shown" aria-label={`Show ${link.title} again`} onClick={() => setLinkHidden(link.id, false)}>
          <Eye className="size-4" />
        </button>
      ) : (
        <RowMenu link={link} hidden={hidden} />
      )}
    </div>
  )
}

/** A link row that can be dragged to another place in its group. */
export function SortableLinkRow(props: LinkRowProps) {
  const { link } = props.item
  const { canReorder } = useBoardActions()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: link.id,
    data: { type: 'link', groupId: link.group_id },
    disabled: !canReorder,
  })

  return (
    <LinkRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      placeholder={isDragging}
      // The row is not a button to screen readers (the link inside it is what you open),
      // but it keeps the keyboard handling that lets it be moved.
      dragProps={canReorder ? { ...attributes, ...listeners, role: undefined, tabIndex: undefined } : undefined}
    />
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
