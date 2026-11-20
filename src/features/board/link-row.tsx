import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Download, Eye, EyeOff, Lock, MoreHorizontal, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { ComponentProps, CSSProperties, ReactNode, Ref } from 'react'
import { toast } from 'sonner'
import { formatBytes, openFile } from '@/api/files'
import { useDeleteLink } from '@/api/links'
import { useConfirm } from '@/components/app/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBoardActions } from './board-actions'
import { isProduction } from '@/lib/environments'
import type { BoardRow } from './board-model'
import { Favicon } from './favicon'
import { FileIcon } from './file-icon'

interface LinkRowProps {
  row: BoardRow
  groupId: string
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
 * environments: its name, and a small link per environment, each with its own menu.
 */
export function LinkRow({ row, restoring, rowRef, style, placeholder, lifted, dragProps }: LinkRowProps & RowDragProps) {
  const { setLinksHidden, recordOpen } = useBoardActions()
  // A click, a middle click or a cmd-click: each opens the link, so each counts as opened lately.
  const opened = (id: string) => ({ onClick: () => recordOpen(id), onAuxClick: (event: { button: number }) => event.button === 1 && recordOpen(id) })
  const [first] = row.links
  const hidden = row.links.filter(({ item }) => item.hidden).map(({ item }) => item.link.id)

  return (
    <div ref={rowRef} style={style} className={cn('tab', placeholder && 'is-placeholder', lifted && 'is-lifted')} {...dragProps}>
      {first.item.link.kind === 'file' ? (
        <a
          className="open"
          href={first.item.link.url}
          draggable={false}
          onClick={(event) => {
            // The file's address needs the person's sign-in, which a plain link doesn't carry.
            event.preventDefault()
            recordOpen(first.item.link.id)
            openFile(first.item.link).catch(toastError)
          }}
        >
          <FileIcon type={first.item.link.file_type} name={first.item.link.file_name} />
          <span className="title">{row.title}</span>
          {first.item.link.visibility !== 'everyone' && <Restricted />}
          {first.item.link.file_size !== null && <span className="file-size">{formatBytes(first.item.link.file_size)}</span>}
        </a>
      ) : first.environment === null ? (
        <a className="open" href={first.item.link.url} target="_blank" rel="noreferrer" draggable={false} {...opened(first.item.link.id)}>
          <Favicon url={first.item.link.url} iconUrl={first.item.link.icon_url} title={row.title} />
          <span className="title">{row.title}</span>
          {first.item.link.visibility !== 'everyone' && <Restricted />}
        </a>
      ) : (
        <div className="open">
          <Favicon url={first.item.link.url} iconUrl={first.item.link.icon_url} title={row.title} />
          <span className="title">{row.title}</span>
          <span className="envs">
            {row.links.map(({ item, environment }) => (
              <span key={item.link.id} className="env-item">
                <a
                  className={cn('env', isProduction(environment!) && 'is-production')}
                  href={item.link.url}
                  target="_blank"
                  rel="noreferrer"
                  draggable={false}
                  aria-label={`${row.title}, ${environment}`}
                  {...opened(item.link.id)}
                >
                  {environment}
                  {item.link.visibility !== 'everyone' && <Restricted />}
                </a>
                {!(restoring && item.hidden) && (
                  <LinkMenu link={item.link} hidden={item.hidden} label={`More for ${row.title}, ${environment}`} className="env-more">
                    <MoreVertical className="size-3.5" />
                  </LinkMenu>
                )}
              </span>
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
        // A line with several environments has a menu on each of them instead.
        first.environment === null && (
          <LinkMenu link={first.item.link} hidden={first.item.hidden} label={`More for ${row.title}`} className="room-button">
            <MoreHorizontal className="size-4" />
          </LinkMenu>
        )
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

/** The menu of one link: copy the address (or download the file), hide it for yourself, and for the space's admins: edit and delete. */
function LinkMenu({ link, hidden, label, className, children }: { link: Link; hidden: boolean; label: string; className: string; children: ReactNode }) {
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
    <DropdownMenu>
      <DropdownMenuTrigger className={className} aria-label={label}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        {link.kind === 'file' ? (
          <DropdownMenuItem onClick={() => openFile(link, true).catch(toastError)}>
            <Download />
            Download
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={copy}>
            <Copy />
            Copy address
          </DropdownMenuItem>
        )}
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
                  description: link.kind === 'file' ? 'The file is removed from the board and from storage, for everyone.' : 'The link is removed from the board for everyone.',
                  confirmLabel: link.kind === 'file' ? 'Delete file' : 'Delete link',
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
