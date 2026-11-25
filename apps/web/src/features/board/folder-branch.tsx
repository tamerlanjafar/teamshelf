import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronRight, Folder as FolderIcon, FolderInput, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useFolderActions } from '@/features/folders/folder-dialogs'
import { roomInside } from '@/features/folders/folder-tree'
import { setFolderOpen, useOpenFolders } from '@/features/folders/open-folders'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import type { Folder, Group } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { BoardCard, BoardLink, FolderNode } from './board-model'
import { CARD_BUTTON, LinkRow, SortableLinkRow } from './link-row'

interface BranchProps {
  card: BoardCard
  folders: FolderNode[]
  links: BoardLink[]
  /** The folder these are in. null: the top of the card. */
  folderId: string | null
  restoring: boolean
  /** The copy of a card that follows the pointer: nothing in it is sortable. */
  lifted?: boolean
}

/**
 * What is at one level of a card: its folders first (by name), each opening in place, then its
 * links, which can be dragged to another place among themselves.
 */
export function Branch({ card, folders, links, folderId, restoring, lifted }: BranchProps) {
  const Row = lifted ? LinkRow : SortableLinkRow
  return (
    <>
      {folders.map((node) => (
        <FolderBranch key={node.folder.id} card={card} node={node} restoring={restoring} lifted={lifted} />
      ))}
      <SortableContext items={links.map((item) => item.link.id)} strategy={verticalListSortingStrategy}>
        {links.map((item) => (
          <Row key={item.link.id} row={{ id: item.link.id, title: item.link.title, item }} groupId={card.group.id} folderId={folderId} restoring={restoring && !card.hidden} />
        ))}
      </SortableContext>
    </>
  )
}

/** A folder's line, and when it is open, what is inside it, indented along a thin line in the card's color. */
function FolderBranch({ card, node, restoring, lifted }: { card: BoardCard; node: FolderNode; restoring: boolean; lifted?: boolean }) {
  const openFolders = useOpenFolders()
  // In the view of what you hid, folders open by themselves: what is in them is what to look through.
  const open = openFolders.has(node.folder.id) || (restoring && node.count > 0)
  const inside = useId()
  const { folder, count } = node
  const empty = node.folders.length === 0 && node.links.length === 0
  const { mounted, expanded } = useCollapse(open)
  // A link dragged here goes into this folder: its line, and when open, all that is inside it
  // (the innermost folder under the pointer wins, see sortable-board.tsx).
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}`, data: { type: 'area', groupId: card.group.id, folderId: folder.id }, disabled: lifted })
  // Held over a closed folder for a moment, it opens, to go further in.
  useEffect(() => {
    if (!isOver || open) return
    const later = setTimeout(() => setFolderOpen(folder.id, true), 650)
    return () => clearTimeout(later)
  }, [isOver, open, folder.id])

  return (
    <div ref={setNodeRef} className={cn('flex flex-col rounded-md transition-[background-color,box-shadow] duration-150', isOver && DROP_TARGET)}>
      <div data-row className="group/row relative flex min-h-[34px] items-center gap-1.5 rounded-md pr-1 hover:bg-[color-mix(in_srgb,var(--c)_14%,transparent)] has-[:focus-visible]:bg-[color-mix(in_srgb,var(--c)_14%,transparent)]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={inside}
          onClick={() => setFolderOpen(folder.id, !open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pl-1 text-left outline-none"
        >
          <ChevronRight className={cn('text-quiet size-3.5 flex-none transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')} strokeWidth={2.5} aria-hidden="true" />
          {open ? <FolderOpen className={FOLDER_ICON} aria-hidden="true" /> : <FolderIcon className={FOLDER_ICON} aria-hidden="true" />}
          <span className="min-w-0 leading-[22px] font-medium wrap-break-word">{folder.name}</span>
          {/* How many links it holds, right after its name, as the card's own count: the right of a card is for file sizes. */}
          <span className="min-w-[20px] flex-none rounded-full bg-[color-mix(in_srgb,var(--c)_14%,transparent)] px-1.5 py-px text-center [font:600_11.5px/1.4_var(--font-rounded)] text-[color-mix(in_srgb,var(--c)_50%,var(--ink))] tabular-nums">
            {count}
            <span className="sr-only"> {count === 1 ? 'link' : 'links'}</span>
          </span>
        </button>
        {!lifted && <FolderMenu group={card.group} folder={folder} folders={card.folders} />}
      </div>
      {mounted && (
        // Slides open to its own height and fades in (a grid row going from 0fr to 1fr), and
        // folds back the same way. Nothing in it can be reached while it is closing.
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div id={inside} role="group" aria-label={folder.name} className="mt-[3px] ml-[13px] flex flex-col gap-[3px] border-l border-[color-mix(in_srgb,var(--c)_28%,var(--line))] pl-1.5">
              <Branch card={card} folders={node.folders} links={node.links} folderId={folder.id} restoring={restoring} lifted={lifted} />
              {empty && <p className="text-quiet m-0 py-1.5 pl-2.5 text-[13px]">Empty folder</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Where a dragged link would land: tinted in the card's color, with an outline. */
export const DROP_TARGET = 'bg-[color-mix(in_srgb,var(--c)_12%,transparent)] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--c)_55%,transparent)]'

/** How long opening and closing take (duration-200 above). */
const COLLAPSE_MS = 200

/**
 * Opening and closing in steps, so both can move: what is inside is put on the page closed, and
 * opened on the next frame; closing folds it first, and takes it off the page after. A folder
 * that is open when the card first draws is simply open.
 */
function useCollapse(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [expanded, setExpanded] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      // Two frames: the first draws it closed, the second starts the opening from there.
      let second = 0
      const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setExpanded(true))))
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    setExpanded(false)
    const gone = setTimeout(() => setMounted(false), COLLAPSE_MS)
    return () => clearTimeout(gone)
  }, [open])
  return { mounted, expanded: open && expanded }
}

/** A folder icon in the card's color. */
const FOLDER_ICON = 'size-[18px] flex-none text-[color-mix(in_srgb,var(--c)_70%,var(--ink))] fill-[color-mix(in_srgb,var(--c)_22%,transparent)]'

/** Adding to a folder, and for the space's admins: a folder inside it, renaming, moving and deleting it. */
function FolderMenu({ group, folder, folders }: { group: Group; folder: Folder; folders: Folder[] }) {
  const { isSpaceAdmin } = usePermissions()
  const admin = isSpaceAdmin(group.space_id)
  const { addLink } = useLinkDialog()
  const { newFolder, renameFolder, move, deleteFolder } = useFolderActions()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(CARD_BUTTON, 'size-[26px] rounded-xs opacity-0 group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100 data-[popup-open]:opacity-100 [@media(hover:none)]:opacity-100')}
        aria-label={`More for ${folder.name}`}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
        <DropdownMenuItem onClick={() => addLink(group.name, folder.id)}>
          <Plus />
          {admin ? 'Add to this folder…' : 'Suggest for this folder…'}
        </DropdownMenuItem>
        {admin && (
          <>
            {roomInside(folder.id, folders) && (
              <DropdownMenuItem onClick={() => newFolder(group, folder.id)}>
                <FolderPlus />
                New folder inside…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => renameFolder(folder, group)}>
              <Pencil />
              Rename…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => move({ kind: 'folder', folder, group })}>
              <FolderInput />
              Move to…
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => deleteFolder(folder, group)}>
              <Trash2 />
              Delete folder…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
