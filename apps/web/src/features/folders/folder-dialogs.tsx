import { createContext, useContext, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { foldersOf, useCreateFolder, useDeleteFolder, useFoldersIfLoaded, useUpdateFolder } from '@/api/folders'
import { useBoardLinksIfLoaded, useMoveLinks } from '@/api/links'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Field, TextInput } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { toastError } from '@/lib/errors'
import type { Folder, Group, Link } from '@/lib/types'
import { FolderSelect } from './folder-select'
import { childrenOf, descendantsOf, moveTargets, pathLabel } from './folder-tree'

const TITLE = 'text-[20px] font-[650] [font-family:var(--font-rounded)]'

/** What the name dialog is for: a new folder (at the top of a group, or inside a folder), or renaming one. */
export type NameRequest = { kind: 'new'; group: Group; parentId: string | null } | { kind: 'rename'; folder: Folder; group: Group }

/** Names a new folder, or renames one. The space's admins. `folders` are the group's. */
export function FolderNameDialog({ request, folders, onClose }: { request: NameRequest | null; folders: Folder[]; onClose: () => void }) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-xl sm:max-w-[420px]">{request && <NameForm request={request} folders={folders} onDone={onClose} />}</DialogContent>
    </Dialog>
  )
}

function NameForm({ request, folders, onDone }: { request: NameRequest; folders: Folder[]; onDone: () => void }) {
  const renaming = request.kind === 'rename' ? request.folder : null
  const parentId = renaming ? renaming.parent_id : request.kind === 'new' ? request.parentId : null
  const [name, setName] = useState(renaming?.name ?? '')
  const [attempted, setAttempted] = useState(false)
  const createFolder = useCreateFolder()
  const updateFolder = useUpdateFolder()
  const saving = createFolder.isPending || updateFolder.isPending
  const where = parentId ? pathLabel(parentId, folders) : request.group.name

  // The same checks as the database (010_folders.sql), so the reason shows before saving.
  const taken = childrenOf(parentId, folders).some((folder) => folder.id !== renaming?.id && folder.name.toLowerCase() === name.trim().toLowerCase())
  const error = !name.trim() ? 'Give the folder a name.' : name.trim().length > 60 ? 'Keep the name to 60 characters.' : taken ? `${where} already has a folder called ${name.trim()}.` : null
  // After saving, the folders are loaded again before the save counts as done and the dialog
  // closes; the new one would then count as taken by itself. Nothing is said from pressing save
  // until the dialog is gone.
  const showError = !saving && !createFolder.isSuccess && !updateFolder.isSuccess && (attempted || taken)

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (error) return
    if (renaming) {
      updateFolder.mutate({ folder: renaming, name }, { onSuccess: onDone, onError: toastError })
      return
    }
    createFolder.mutate({ spaceId: request.group.space_id, groupId: request.group.id, parentId, name }, { onSuccess: onDone, onError: toastError })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className={TITLE}>{renaming ? 'Rename folder' : 'New folder'}</DialogTitle>
        {!renaming && <p className="text-quiet m-0 text-[13.5px]">In {where}</p>}
      </DialogHeader>
      <Field label="Name" error={showError ? (error ?? undefined) : undefined}>
        <TextInput value={name} maxLength={70} autoFocus placeholder="Runbooks" aria-invalid={Boolean(showError && error)} onChange={(event) => setName(event.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {renaming ? 'Save' : 'Create folder'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** What the move dialog moves: a link (into a folder of its group), or a folder (with what is in it). */
export type MoveRequest = { kind: 'link'; link: Link; group: Group } | { kind: 'folder'; folder: Folder; group: Group }

/** Moves a link or a folder to another place in its group. The space's admins. `folders` are the group's. */
export function MoveDialog({ request, folders, onClose }: { request: MoveRequest | null; folders: Folder[]; onClose: () => void }) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-xl sm:max-w-[440px]">{request && <MoveForm request={request} folders={folders} onDone={onClose} />}</DialogContent>
    </Dialog>
  )
}

function MoveForm({ request, folders, onDone }: { request: MoveRequest; folders: Folder[]; onDone: () => void }) {
  const id = useId()
  const current = request.kind === 'link' ? request.link.folder_id : request.folder.parent_id
  const [target, setTarget] = useState<string | null>(current ?? null)
  const moveLinks = useMoveLinks()
  const updateFolder = useUpdateFolder()
  const saving = moveLinks.isPending || updateFolder.isPending
  const name = request.kind === 'link' ? request.link.title : request.folder.name

  // A folder can't go inside itself, nor so deep that what is in it goes past the deepest level.
  const allowed = request.kind === 'folder' ? new Set(moveTargets(request.folder, folders).map((choice) => choice.folder.id)) : null
  const exclude = allowed ? folders.filter((folder) => !allowed.has(folder.id)).map((folder) => folder.id) : []
  const inside = request.kind === 'folder' ? descendantsOf(request.folder.id, folders).length : 0

  function submit(event: FormEvent) {
    event.preventDefault()
    const done = () => {
      toast.success(`Moved ${name} to ${target ? pathLabel(target, folders) : `the top of ${request.group.name}`}.`)
      onDone()
    }
    if (request.kind === 'link') moveLinks.mutate({ links: [request.link], folderId: target }, { onSuccess: done, onError: toastError })
    else updateFolder.mutate({ folder: request.folder, parentId: target }, { onSuccess: done, onError: toastError })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className={TITLE}>Move {name}</DialogTitle>
        <p className="text-quiet m-0 text-[13.5px]">
          {request.kind === 'folder' ? `Everything in it moves along${inside ? `, with the ${inside} ${inside === 1 ? 'folder' : 'folders'} inside it` : ''}.` : `To another folder of ${request.group.name}.`}
        </p>
      </DialogHeader>
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium">
          Move to
        </label>
        <FolderSelect id={id} folders={folders} groupName={request.group.name} value={target} exclude={exclude} onChange={setTarget} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || target === (current ?? null)}>
          Move
        </Button>
      </DialogFooter>
    </form>
  )
}

/** What can be done with folders, from anywhere on a board. The space's admins. */
interface FolderActions {
  newFolder: (group: Group, parentId: string | null) => void
  renameFolder: (folder: Folder, group: Group) => void
  move: (request: MoveRequest) => void
  /** Asks first, saying what goes with it: the folders and links inside, at any depth. */
  deleteFolder: (folder: Folder, group: Group) => void
}

const FolderActionsContext = createContext<FolderActions | null>(null)

export function useFolderActions() {
  const actions = useContext(FolderActionsContext)
  if (!actions) throw new Error('useFolderActions needs a FolderActionsProvider above it.')
  return actions
}

/** Holds the folder dialogs of the app, so a card's lines and menus can open them. */
export function FolderActionsProvider({ children }: { children: ReactNode }) {
  const allFolders = useFoldersIfLoaded()
  const boardLinks = useBoardLinksIfLoaded()
  const confirm = useConfirm()
  const deleteFolder = useDeleteFolder()
  const [naming, setNaming] = useState<NameRequest | null>(null)
  const [moving, setMoving] = useState<MoveRequest | null>(null)

  const actions = useMemo<FolderActions>(
    () => ({
      newFolder: (group, parentId) => setNaming({ kind: 'new', group, parentId }),
      renameFolder: (folder, group) => setNaming({ kind: 'rename', folder, group }),
      move: setMoving,
      deleteFolder: (folder, group) => {
        const folders = foldersOf(allFolders, group.id)
        const inside = descendantsOf(folder.id, folders)
        const ids = new Set([folder.id, ...inside.map((one) => one.id)])
        const links = boardLinks.filter((link) => link.folder_id && ids.has(link.folder_id)).length
        const contents = [links && `${links} ${links === 1 ? 'link' : 'links'}`, inside.length && `${inside.length} ${inside.length === 1 ? 'folder' : 'folders'}`].filter(Boolean).join(' and ')
        confirm({
          title: `Delete ${folder.name}?`,
          description: contents ? `The folder and everything in it (${contents}) will be removed for everyone.` : 'The folder is empty.',
          confirmLabel: 'Delete folder',
          onConfirm: () => deleteFolder.mutate(folder.id, { onError: toastError }),
        })
      },
    }),
    [allFolders, boardLinks, confirm, deleteFolder],
  )

  const groupId = naming?.group.id ?? moving?.group.id
  const folders = foldersOf(allFolders, groupId)
  return (
    <FolderActionsContext value={actions}>
      {children}
      <FolderNameDialog request={naming} folders={folders} onClose={() => setNaming(null)} />
      <MoveDialog request={moving} folders={folders} onClose={() => setMoving(null)} />
    </FolderActionsContext>
  )
}
