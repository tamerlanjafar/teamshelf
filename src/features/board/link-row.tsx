import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Eye, EyeOff, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ComponentProps, CSSProperties, Ref } from 'react'
import { toast } from 'sonner'
import { useDeleteLink } from '@/api/links'
import { useConfirm } from '@/components/app/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Category, Link } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBoardActions } from './board-actions'
import { isProduction, type BoardRow } from './board-model'
import { CategoryTag } from './category-tag'
import { Favicon } from './favicon'

interface LinkRowProps {
  row: BoardRow
  groupId: string
  /** The categories to name on this line. Empty when the card names its one category itself. */
  categories: Category[]
  /** In the view of what you hid: the line gets an eye button that brings its links back. */
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

const Restricted = () => <Lock className="text-quiet size-3 flex-none" aria-label="Only some people see this" />

/**
 * One line of a card. A single link: the whole line opens it. One thing in several
 * environments: its name, and a small link per environment.
 */
export function LinkRow({ row, categories, restoring, rowRef, style, placeholder, lifted, dragProps }: LinkRowProps & RowDragProps) {
  const { setLinksHidden } = useBoardActions()
  const [first] = row.links
  const hidden = row.links.filter(({ item }) => item.hidden).map(({ item }) => item.link.id)
  const tags = categories.map((category) => <CategoryTag key={category.id} category={category} />)

  return (
    <div ref={rowRef} style={style} className={cn('tab', placeholder && 'is-placeholder', lifted && 'is-lifted')} {...dragProps}>
      {first.environment === null ? (
        <a className="open" href={first.item.link.url} target="_blank" rel="noreferrer" draggable={false}>
          <Favicon url={first.item.link.url} iconUrl={first.item.link.icon_url} title={row.title} />
          <span className="title">{row.title}</span>
          {first.item.link.visibility !== 'everyone' && <Restricted />}
          {tags}
        </a>
      ) : (
        <div className="open">
          <Favicon url={first.item.link.url} iconUrl={first.item.link.icon_url} title={row.title} />
          <span className="title">{row.title}</span>
          {tags}
          <span className="envs">
            {row.links.map(({ item, environment }) => (
              <a key={item.link.id} className={cn('env', isProduction(environment!) && 'is-production')} href={item.link.url} target="_blank" rel="noreferrer" draggable={false} aria-label={`${row.title}, ${environment}`}>
                {environment}
                {item.link.visibility !== 'everyone' && <Restricted />}
              </a>
            ))}
          </span>
        </div>
      )}
      {restoring && hidden.length > 0 ? (
        // In the view of what you hid, the one thing to do with a line is to bring it back:
        // an eye where the menu usually is, so the name keeps its room.
        <button type="button" className="room-button shown" aria-label={`Show ${row.title} again`} onClick={() => setLinksHidden(hidden, false)}>
          <Eye className="size-4" />
        </button>
      ) : (
        <RowMenu row={row} />
      )}
    </div>
  )
}

/** A row that can be dragged to another place in its group. */
export function SortableLinkRow(props: LinkRowProps) {
  const { canReorder } = useBoardActions()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: props.row.id,
    data: { type: 'link', groupId: props.groupId },
    disabled: !canReorder,
  })

  return (
    <LinkRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      placeholder={isDragging}
      // The row is not a button to screen readers (the links inside it are what you open),
      // but it keeps the keyboard handling that lets it be moved.
      dragProps={canReorder ? { ...attributes, ...listeners, role: undefined, tabIndex: undefined } : undefined}
    />
  )
}

/** What can be done with the line: for a single link directly, for several environments one menu each. */
function RowMenu({ row }: { row: BoardRow }) {
  const [first] = row.links
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="room-button" aria-label={`More for ${row.title}`}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        {first.environment === null ? (
          <LinkActions link={first.item.link} hidden={first.item.hidden} />
        ) : (
          row.links.map(({ item, environment }) => (
            <DropdownMenuSub key={item.link.id}>
              <DropdownMenuSubTrigger>{environment}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-44 rounded-xl">
                <LinkActions link={item.link} hidden={item.hidden} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Copy the address, hide the link for yourself, and for whoever manages the link: edit and delete. */
function LinkActions({ link, hidden }: { link: Link; hidden: boolean }) {
  const { canManage } = usePermissions()
  const { setLinksHidden } = useBoardActions()
  const { editLink } = useLinkDialog()
  const confirm = useConfirm()
  const deleteLink = useDeleteLink()

  const copy = () =>
    navigator.clipboard.writeText(link.url).then(
      () => toast.success('Address copied.'),
      () => toast.error("The address couldn't be copied."),
    )

  return (
    <>
      <DropdownMenuItem onClick={copy}>
        <Copy />
        Copy address
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setLinksHidden([link.id], !hidden)}>
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
    </>
  )
}
