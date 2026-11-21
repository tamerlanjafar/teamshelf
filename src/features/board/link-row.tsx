import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Download, Eye, EyeOff, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
import type { BoardRow } from './board-model'
import { Favicon } from './favicon'
import { FileIcon } from './file-icon'

interface LinkRowProps {
  row: BoardRow
  groupId: string
  /** In the view of what you hid: the line gets an eye button that brings the link back. */
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

const Restricted = ({ className }: { className?: string }) => <Lock className={cn('text-quiet size-3 flex-none', className)} aria-label="Only some people see this" />

// The card's color (--c), mixed in. Rows react to the pointer, and to focus from the keyboard
// (:focus-visible), not to any focus: a menu hands focus back to its button when it closes, and
// the row would stay lit although the pointer has left.
// Written out in full: Tailwind finds classes only as whole words in the source.
const LIT_IN_USE = 'hover:bg-[color-mix(in_srgb,var(--c)_14%,transparent)] has-[:focus-visible]:bg-[color-mix(in_srgb,var(--c)_14%,transparent)]'

/** A line of a card, also drawn by the board's skeleton. */
export const ROW = 'relative flex min-h-[34px] items-start gap-1.5 rounded-md pr-1'

/** What you click on a line: its icon and name. */
export const ROW_OPEN = 'flex min-w-0 flex-1 items-start gap-2.5 rounded-md py-1.5 pr-1 pl-2.5'

/** The name of a line. A long one wraps between words instead of being cut off. */
const TITLE = 'min-w-0 flex-1 leading-[22px] wrap-break-word'

/**
 * A small square button in a card: the menu of a card, or of a line. Each place gives it its
 * size and corners: on a line it sits 4px in from the line's edge, so its corners are the
 * line's (10px) less those 4px, and the two curves run alongside each other.
 */
export const CARD_BUTTON =
  'text-quiet grid flex-none place-items-center hover:text-ink hover:bg-[color-mix(in_srgb,var(--c)_18%,transparent)] data-[popup-open]:text-ink data-[popup-open]:bg-[color-mix(in_srgb,var(--c)_18%,transparent)]'

/** The button on a line: 26px, 4px in from the line's edge. */
const LINE_BUTTON = 'mt-1 size-[26px] rounded-xs'

/** Shows only while its line is in use (always on a touch screen), so it never takes the name's room. */
const WHEN_IN_USE = 'opacity-0 data-[popup-open]:opacity-100 [@media(hover:none)]:opacity-100'

/** One line of a card: one link or file. The whole line opens it, and it has its own menu. */
export function LinkRow({ row, restoring, rowRef, style, placeholder, lifted, dragProps }: LinkRowProps & RowDragProps) {
  const { setLinksHidden, recordOpen } = useBoardActions()
  const { item } = row
  const { link } = item
  // A click, a middle click or a cmd-click: each opens the link, so each counts as opened lately.
  const opened = { onClick: () => recordOpen(link.id), onAuxClick: (event: { button: number }) => event.button === 1 && recordOpen(link.id) }

  return (
    <div
      ref={rowRef}
      style={style}
      data-row
      className={cn(
        'group/row',
        ROW,
        !placeholder && !lifted && LIT_IN_USE,
        // A finger drags only after a press and hold (see sortable-board.tsx), so a swipe still
        // scrolls. Holding doesn't select text or open the phone's link menu instead.
        dragProps && 'touch-manipulation select-none [-webkit-touch-callout:none]',
        // Its place while it is dragged: an empty, dashed slot.
        placeholder && 'bg-[color-mix(in_srgb,var(--c)_7%,transparent)] outline-[1.5px] -outline-offset-[1.5px] outline-[color-mix(in_srgb,var(--c)_45%,transparent)] outline-dashed *:invisible',
      )}
      {...dragProps}
    >
      {link.kind === 'file' ? (
        <a
          className={ROW_OPEN}
          href={link.url}
          draggable={false}
          onClick={(event) => {
            // The file's address needs the person's sign-in, which a plain link doesn't carry.
            event.preventDefault()
            recordOpen(link.id)
            openFile(link).catch(toastError)
          }}
        >
          <FileIcon type={link.file_type} name={link.file_name} className="mt-[3px]" />
          <span className={TITLE}>{row.title}</span>
          {link.visibility !== 'everyone' && <Restricted className="mt-[5px]" />}
          {link.file_size !== null && <span className="text-quiet flex-none [font:500_12px/22px_var(--font-rounded)] tabular-nums">{formatBytes(link.file_size)}</span>}
        </a>
      ) : (
        <a className={ROW_OPEN} href={link.url} target="_blank" rel="noreferrer" draggable={false} {...opened}>
          <Favicon url={link.url} iconUrl={link.icon_url} title={row.title} className="mt-[3px]" />
          <span className={TITLE}>{row.title}</span>
          {link.visibility !== 'everyone' && <Restricted className="mt-[5px]" />}
        </a>
      )}
      {restoring && item.hidden ? (
        // In the view of what you hid, the one thing to do with a line is to bring it back:
        // an eye where the menu usually is, always there, in the card's color.
        <button
          type="button"
          className={cn(CARD_BUTTON, LINE_BUTTON, 'bg-[color-mix(in_srgb,var(--c)_16%,transparent)] text-[color-mix(in_srgb,var(--c)_55%,var(--ink))] hover:bg-(--c) hover:text-white')}
          aria-label={`Show ${row.title} again`}
          onClick={() => setLinksHidden([link.id], false)}
        >
          <Eye className="size-4" />
        </button>
      ) : (
        <LinkMenu
          link={link}
          hidden={item.hidden}
          label={`More for ${row.title}`}
          className={cn(CARD_BUTTON, WHEN_IN_USE, LINE_BUTTON, 'group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100')}
        >
          <MoreHorizontal className="size-4" />
        </LinkMenu>
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
