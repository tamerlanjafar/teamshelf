import { ArrowDown, ArrowDownAZ, Eye, EyeOff, FolderPlus, FoldVertical, ListRestart, Lock, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
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
import { useFolderActions } from '@/features/folders/folder-dialogs'
import { cardTree, rowsOf, type BoardCard } from './board-model'
import { Branch, DROP_TARGET } from './folder-branch'
import { GroupDialog } from './group-dialog'
import { CARD_BUTTON } from './link-row'
import { dragHeight, dragWidth, HEIGHT_VAR, heightKeys, WHOLE_LIST, widthKeys } from './resize'

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
  /** The card can be resized: its height, and its column's width by each edge that has a column beyond it. */
  resizable?: { left: boolean; right: boolean }
}

/**
 * A card: a group, tinted with its color (--c, set on the card) and lit with it from the top,
 * fading into the surface. It fades in when it first appears. Also drawn by the board's skeleton.
 */
export const CARD =
  'relative flex flex-col rounded-2xl border border-[color-mix(in_srgb,var(--c)_16%,var(--line))] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--c)_var(--wash),var(--surface)),color-mix(in_srgb,var(--c)_var(--wash-low),var(--surface))_110px)] shadow-[0_1px_2px_hsl(var(--shadow)/0.05)] transition-[border-color,box-shadow] duration-150 motion-safe:animate-card-in'

/** A card in use: its border and a glow take its color. */
const CARD_IN_USE =
  'hover:border-[color-mix(in_srgb,var(--c)_42%,transparent)] hover:shadow-[0_1px_2px_hsl(var(--shadow)/0.05),0_10px_24px_-14px_color-mix(in_srgb,var(--c)_55%,transparent)] has-[:focus-visible]:border-[color-mix(in_srgb,var(--c)_42%,transparent)] has-[:focus-visible]:shadow-[0_1px_2px_hsl(var(--shadow)/0.05),0_10px_24px_-14px_color-mix(in_srgb,var(--c)_55%,transparent)]'

/** Its place on the board while it is dragged: an empty, dashed slot. */
const CARD_PLACEHOLDER = 'animate-none border-dashed border-[color-mix(in_srgb,var(--c)_40%,transparent)] bg-[color-mix(in_srgb,var(--c)_7%,transparent)] shadow-none *:invisible'

/** The copy in your hand, following the pointer. */
const CARD_LIFTED =
  'animate-none rotate-[1.2deg] cursor-grabbing border-[color-mix(in_srgb,var(--c)_55%,transparent)] shadow-[0_2px_6px_hsl(var(--shadow)/0.1),0_18px_40px_-12px_hsl(var(--shadow)/0.35)]'

/** A card's name, in its color. It keeps at least its longest word, and wraps between words. */
const CARD_NAME = 'm-0 min-w-min [font:650_18px/1.2_var(--font-rounded)] tracking-[-0.01em] wrap-break-word text-[color-mix(in_srgb,var(--c)_58%,var(--ink))]'

/** How many links a card has, in a pill of its color, right after its name (the right of a card is for file sizes). */
const CARD_COUNT = 'min-w-[26px] flex-none rounded-full bg-[color-mix(in_srgb,var(--c)_18%,transparent)] px-2 py-[3px] text-center [font:600_12px/1.2_var(--font-rounded)] text-[color-mix(in_srgb,var(--c)_50%,var(--ink))] tabular-nums'

export const CARD_HEAD = 'flex min-h-[54px] items-center gap-2 pt-3.5 pr-2.5 pb-2.5 pl-4'

/** The lines of a card, with a little air between them, so two highlighted lines never touch. */
export const CARD_BODY = 'flex flex-col gap-[3px] px-1.5 pb-2'

/**
 * On a tablet or a computer, a card stops growing at a part of the screen (or at the height it
 * was resized to, --card-h) and its list scrolls
 * inside it, so one long group doesn't stretch its column far past the others. The edge fades
 * where lines are hidden below (--fade-bottom; above, the lines of the folders scrolled through stay
 * in view instead, see folder-branch.tsx), a slim scrollbar in the card's color stays
 * in view (macOS hides scrollbars otherwise), and lines keep their own height instead of being
 * squeezed. On a phone the cards are one column, so a card shows its whole list.
 */
const CAPPED =
  'sm:max-h-[var(--card-h,min(62dvh,640px))] sm:overflow-y-auto sm:overscroll-contain sm:*:shrink-0 sm:[mask-image:linear-gradient(to_bottom,#000_calc(100%-var(--fade-bottom,0px)),transparent_100%)] sm:focus-visible:rounded-xl sm:focus-visible:outline-2 sm:focus-visible:-outline-offset-2 sm:focus-visible:outline-[color-mix(in_srgb,var(--c)_50%,transparent)] sm:[&::-webkit-scrollbar]:w-1.5 sm:[&::-webkit-scrollbar-track]:my-1.5 sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--c)_35%,transparent)] sm:[&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--c)_55%,transparent)] supports-[not_selector(::-webkit-scrollbar)]:sm:[scrollbar-width:thin] supports-[not_selector(::-webkit-scrollbar)]:sm:[scrollbar-color:color-mix(in_srgb,var(--c)_40%,transparent)_transparent]'

/** A group and its links, tinted with the group's color. As tall as what is in it, up to a part of the screen. */
export function GroupCard({ card, restoring, cardRef, dragStyle, placeholder, lifted, headProps, resizable }: GroupCardProps & CardDragProps) {
  const { group, hidden } = card
  const { setGroupHidden, cardHeight, resizeCard, resizeColumns, isResized, editing: arranging } = useBoardActions()
  // A height this person set themselves holds, whatever is open in the card. The space's default
  // height (for everyone, with their own folders open or closed) is a limit: the card is as tall
  // as what is in it, up to there. So it is in the layout editor too.
  const holdsHeight = !arranging && isResized(group.id)
  const height = cardHeight(group.id)
  const rows = rowsOf(card)
  const { isSpaceAdmin } = usePermissions()
  // The space's admins see empty folders on the board, to add to them.
  const tree = cardTree(card, isSpaceAdmin(group.space_id) && !restoring)
  // A link dragged out of its folder, onto the card outside any folder or onto its header (always
  // there, also when an open folder fills the card), goes to the top of the group.
  const toTop = { type: 'area', groupId: group.id, folderId: null }
  const drop = useDroppable({ id: `card:${group.id}`, data: toTop, disabled: lifted || card.folders.length === 0 })
  const dropOnHead = useDroppable({ id: `card-head:${group.id}`, data: toTop, disabled: lifted || card.folders.length === 0 })
  // A card stops growing at a part of the screen and scrolls inside itself. Its edges fade
  // where lines are hidden above or below.
  const body = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false, below: 0 })
  const measureEdges = () => {
    const node = body.current
    if (!node) return
    const end = node.scrollTop + node.clientHeight
    // The lines that start below what is in view: what the "more" pill counts.
    // Lines inside open folders count too. offsetTop is from the card (the nearest positioned box).
    const below = [...node.querySelectorAll<HTMLElement>('[data-row]')].filter((child) => child.offsetTop - node.offsetTop + child.offsetHeight / 2 > end).length
    const next = { top: node.scrollTop > 2, bottom: end < node.scrollHeight - 2, below }
    setEdges((current) => (current.top === next.top && current.bottom === next.bottom && current.below === next.below ? current : next))
    // Folder lines stuck at the top (their folder has scrolled past them): marked, so they cover
    // what goes under them.
    const bodyTop = node.getBoundingClientRect().top
    for (const row of node.querySelectorAll<HTMLElement>('[data-folder-row]')) {
      const top = row.getBoundingClientRect().top
      const from = top - bodyTop
      // Held at the top: at its place there, or being pushed out by the end of its folder (still
      // in view), with its folder starting above it.
      const held = from <= (parseFloat(row.style.top) || 0) + 1 && from + row.offsetHeight > 0
      const isStuck = node.scrollTop > 0 && held && getComputedStyle(row).position === 'sticky' && (row.parentElement?.getBoundingClientRect().top ?? top) < top - 0.5
      row.toggleAttribute('data-stuck', isStuck)
    }
  }
  // Measured again after every change (links moved into folders change neither the card's size
  // nor its count), and whenever the card or any part of its list changes size (a folder opening
  // or closing inside a card that has stopped growing).
  const observer = useRef<ResizeObserver | null>(null)
  useLayoutEffect(() => {
    const node = body.current
    if (!node) return
    measureEdges()
    observer.current ??= new ResizeObserver(() => measureEdges())
    observer.current.observe(node)
    for (const child of node.children) observer.current.observe(child)
  })
  useLayoutEffect(() => () => observer.current?.disconnect(), [])

  return (
    <section
      ref={cardRef}
      data-card
      className={cn('group/card', CARD, placeholder ? CARD_PLACEHOLDER : lifted ? CARD_LIFTED : CARD_IN_USE)}
      style={{ '--c': colorValue(group.color), ...dragStyle } as CSSProperties}
      aria-label={group.name}
    >
      <header
        ref={dropOnHead.setNodeRef}
        className={cn(
          CARD_HEAD,
          'rounded-t-2xl transition-[background-color,box-shadow] duration-150',
          dropOnHead.isOver && DROP_TARGET,
          // Picked up by its header. A finger drags only after a press and hold (see
          // sortable-board.tsx), so a swipe still scrolls, and holding selects no text.
          headProps && 'cursor-grab touch-manipulation select-none [-webkit-touch-callout:none]',
          lifted && 'cursor-grabbing',
        )}
        {...headProps}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className={CARD_NAME}>{group.name}</h2>
          {group.visibility && group.visibility !== 'everyone' && <Lock className="text-quiet size-3.5 flex-none" aria-label="Only some people see this group" />}
          <span className={CARD_COUNT} aria-label={`${rows.length} ${rows.length === 1 ? 'link' : 'links'}`}>
            {rows.length}
          </span>
        </div>
        {restoring && hidden && <RestoreButton label={`Show ${group.name} again`} onClick={() => setGroupHidden(group.id, false)} />}
        <GroupMenu card={card} />
      </header>
      <div
        ref={(node) => {
          body.current = node
          drop.setNodeRef(node)
        }}
        data-card-list
        className={cn(
          CARD_BODY,
          !lifted && CAPPED,
          // Your own height holds, folders opening and closing don't move it (see holdsHeight).
          // Pulled to the end of the list, it stays as tall as the list.
          !lifted && holdsHeight && height !== undefined && height < WHOLE_LIST && 'sm:h-[var(--card-h)]', edges.bottom && '[--fade-bottom:72px]', 'rounded-b-2xl transition-[background-color,box-shadow] duration-150', drop.isOver && DROP_TARGET)}
        style={height === undefined || lifted ? undefined : ({ [HEIGHT_VAR]: `${height}px` } as CSSProperties)}
        onScroll={measureEdges}
        tabIndex={edges.bottom || edges.top ? 0 : undefined}
        aria-label={edges.bottom || edges.top ? `${group.name} links` : undefined}
      >
        {rows.length === 0 && tree.folders.length === 0 && <EmptyGroup card={card} />}
        <Branch card={card} folders={tree.folders} links={tree.links} folderId={null} restoring={restoring} lifted={lifted} />
      </div>
      {!lifted && edges.bottom && edges.below > 0 && (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--c)_14%,var(--surface))] py-[5px] pr-[11px] pl-[9px] [font:600_12.5px/1.2_var(--font-rounded)] text-[color-mix(in_srgb,var(--c)_65%,var(--ink))] tabular-nums shadow-[0_0_0_1px_color-mix(in_srgb,var(--c)_22%,transparent),0_4px_12px_-4px_hsl(var(--shadow)/0.25)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--c)_22%,var(--surface))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--c)_60%,transparent)] sm:inline-flex"
          onClick={() => body.current?.scrollBy({ top: body.current.clientHeight * 0.8, behavior: 'smooth' })}
          aria-label={`Scroll down: ${edges.below} more in ${group.name}`}
        >
          <ArrowDown className="size-3.5" />
          {edges.below} more
        </button>
      )}
      {resizable && !placeholder && (
        <>
          <ResizeHandle
            edge="bottom"
            label={`Height of ${group.name}`}
            onPointerDown={(event) => body.current && dragHeight(event, body.current, (next) => resizeCard(group.id, next))}
            onKeyDown={(event) => body.current && heightKeys(event, body.current, (next) => resizeCard(group.id, next))}
            onDoubleClick={() => resizeCard(group.id, undefined)}
          />
          {(['left', 'right'] as const)
            .filter((side) => resizable[side])
            .map((side) => (
              <ResizeHandle
                key={side}
                edge={side}
                label={`Width of ${group.name}'s column, ${side} edge`}
                onPointerDown={(event) => dragWidth(event, columnOf(event.currentTarget), side, resizeColumns)}
                onKeyDown={(event) => widthKeys(event, columnOf(event.currentTarget), side, resizeColumns)}
                onDoubleClick={() => resizeColumns(undefined)}
              />
            ))}
        </>
      )}
    </section>
  )
}

/** A group card that can be dragged, by its header, to any column and any place in it. */
export function SortableGroupCard(props: GroupCardProps & Pick<CardDragProps, 'resizable'>) {
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

/** A group with no links: the way to add the first one, right where it will appear. */
function EmptyGroup({ card }: { card: BoardCard }) {
  const { isSpaceAdmin } = usePermissions()
  const { addLink } = useLinkDialog()
  const admin = isSpaceAdmin(card.group.space_id)
  return (
    <button
      type="button"
      onClick={() => addLink(card.group.name)}
      className="text-quiet hover:text-ink hover:bg-ink/5 mx-0.5 mb-1 flex w-[calc(100%-4px)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] font-medium transition-colors"
    >
      <Plus className="size-4" />
      {admin ? 'Add the first item' : 'Suggest the first item'}
    </button>
  )
}

/** Hide the group for yourself, go back to the default height or order of its links, and for the space's admins: edit and delete (and, while editing the default layout, sort). */
function GroupMenu({ card }: { card: BoardCard }) {
  const { group, hidden, ownLinkOrder } = card
  const { isSpaceAdmin } = usePermissions()
  const admin = isSpaceAdmin(group.space_id)
  const { editing: arranging, setGroupHidden, sortLinksByName, useTeamLinkOrder: resetLinkOrder, isResized, resizeCard } = useBoardActions()
  const { addLink } = useLinkDialog()
  const { newFolder } = useFolderActions()
  const confirm = useConfirm()
  const deleteGroup = useDeleteGroup()
  const [editing, setEditing] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(CARD_BUTTON, 'size-[26px] rounded-sm')} aria-label={`More for ${group.name}`}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
          <DropdownMenuItem onClick={() => addLink(group.name)}>
            <Plus />
            {admin ? 'Add to this group…' : 'Suggest for this group…'}
          </DropdownMenuItem>
          {/* Hiding is for yourself: not while arranging the board for everyone. */}
          {!arranging && (
            <DropdownMenuItem onClick={() => setGroupHidden(group.id, !hidden)}>
              {hidden ? <Eye /> : <EyeOff />}
              {hidden ? 'Show again' : 'Hide for me'}
            </DropdownMenuItem>
          )}
          {isResized(group.id) && (
            <DropdownMenuItem onClick={() => resizeCard(group.id, undefined)}>
              <FoldVertical />
              Auto height
            </DropdownMenuItem>
          )}
          {/* Your own order (as dragging links is); while editing, the space's order for everyone. */}
          {card.links.length > 1 && (
            <DropdownMenuItem onClick={() => sortLinksByName(group.id)}>
              <ArrowDownAZ />
              Sort links A to Z
            </DropdownMenuItem>
          )}
          {ownLinkOrder && (
            <DropdownMenuItem onClick={() => resetLinkOrder(group.id)}>
              <ListRestart />
              {arranging ? 'Undo the new order' : 'Use the space\'s order'}
            </DropdownMenuItem>
          )}
          {admin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => newFolder(group, null)}>
                <FolderPlus />
                New folder…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil />
                Edit…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  confirm({
                    title: `Delete ${group.name}?`,
                    description: 'The group and every link in it will be removed for everyone.',
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
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-6 flex-none items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--c)_16%,transparent)] pr-[9px] pl-[7px] [font:600_12px/1_var(--font-rounded)] text-[color-mix(in_srgb,var(--c)_55%,var(--ink))] hover:bg-(--c) hover:text-white"
    >
      <Eye className="size-3.5" />
      Show
    </button>
  )
}

/** The board column a card is in. */
const columnOf = (node: HTMLElement) => node.closest<HTMLElement>('[data-column]')!

/**
 * An edge of a card to drag for resizing: the bottom for its height, the left or right one (in the
 * gap to the column beside it) for its column's width. Only edges with a column beyond them. A small grip shows on it while the card is in use.
 * With the keyboard: arrows resize, Home goes back to the usual size; so does a double-click.
 * Its name (for screen readers) says what it resizes; the grip itself shows what it does.
 * Not on a phone or a touch screen, where cards are one column and as tall as their links.
 */
function ResizeHandle({ edge, label, ...handlers }: { edge: 'bottom' | 'left' | 'right'; label: string } & Pick<ComponentProps<'div'>, 'onPointerDown' | 'onKeyDown' | 'onDoubleClick'>) {
  const bottom = edge === 'bottom'
  return (
    <div
      role="separator"
      aria-orientation={bottom ? 'horizontal' : 'vertical'}
      aria-label={label}
      tabIndex={0}
      className={cn(
        'group/grip absolute z-10 hidden touch-none place-items-center outline-none sm:grid [@media(hover:none)]:hidden',
        // Each side handle covers its own half of the gap between columns (and a little of the
        // card), so the handles of two cards next to each other never overlap.
        bottom ? 'inset-x-8 -bottom-[7px] h-3.5 cursor-ns-resize' : cn('top-6 bottom-6 w-[11px] cursor-ew-resize', edge === 'right' ? '-right-[5px] justify-items-end' : '-left-[5px] justify-items-start'),
      )}
      {...handlers}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-full bg-[color-mix(in_srgb,var(--c)_45%,transparent)] opacity-0 transition-[opacity,background-color] duration-150 group-hover/card:opacity-100 group-hover/grip:bg-(--c) group-hover/grip:opacity-100 group-focus-visible/grip:bg-(--c) group-focus-visible/grip:opacity-100 group-active/grip:bg-(--c) group-active/grip:opacity-100',
          // The grip sits in the middle of the gap, at the handle's outer end.
          bottom ? 'h-1 w-10' : cn('h-10 w-1', edge === 'right' ? 'translate-x-1/2' : '-translate-x-1/2'),
        )}
      />
    </div>
  )
}
