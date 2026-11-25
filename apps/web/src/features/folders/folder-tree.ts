// Folders inside a group, as a tree: where a folder is, what is inside it, and how it reads.
// Pure functions, no React.

// Relative, so the unit tests (plain Node) find it.
import { MAX_FOLDER_DEPTH, type Folder } from '../../lib/types.ts'

/** Folders side by side are listed by name. */
export const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

/** The folders a folder is in, from the top of its group down to the folder itself. */
export function pathOf(folderId: string | null | undefined, folders: Folder[]): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: Folder[] = []
  // A broken chain (a parent that isn't there, or a loop) ends the path instead of hanging.
  for (let at = folderId ? byId.get(folderId) : undefined; at && !path.includes(at); at = at.parent_id ? byId.get(at.parent_id) : undefined) path.unshift(at)
  return path
}

/** "Pipelines / Warehouse": where a folder is in its group. */
export const pathLabel = (folderId: string | null | undefined, folders: Folder[]) =>
  pathOf(folderId, folders)
    .map((folder) => folder.name)
    .join(' / ')

/** How deep a folder is: one at the top of its group is 1 deep. */
export const depthOf = (folderId: string, folders: Folder[]) => pathOf(folderId, folders).length

/** The folders right inside a folder (or at the top of the group: null), by name. */
export const childrenOf = (parentId: string | null, folders: Folder[]) => folders.filter((folder) => (folder.parent_id ?? null) === parentId).sort(byName)

/** Every folder inside a folder, at any depth (not the folder itself). */
export function descendantsOf(folderId: string, folders: Folder[]): Folder[] {
  const found: Folder[] = []
  const visit = (id: string) => {
    for (const child of folders.filter((folder) => folder.parent_id === id)) {
      if (found.includes(child)) continue
      found.push(child)
      visit(child.id)
    }
  }
  visit(folderId)
  return found
}

/** How many levels go below a folder (0: it has no folders in it). */
export function levelsBelow(folderId: string, folders: Folder[]): number {
  const children = folders.filter((folder) => folder.parent_id === folderId)
  return children.length === 0 ? 0 : 1 + Math.max(...children.map((child) => levelsBelow(child.id, folders)))
}

/** A folder of a group, listed for choosing: as deep as it is, with its whole path. */
export interface FolderChoice {
  folder: Folder
  depth: number
  path: string
}

/** Every folder of a group, top down, each followed by what is inside it: the order a tree is read in. */
export function treeOrder(folders: Folder[]): FolderChoice[] {
  const list: FolderChoice[] = []
  const walk = (parentId: string | null, depth: number, path: string) => {
    for (const folder of childrenOf(parentId, folders)) {
      const here = path ? `${path} / ${folder.name}` : folder.name
      list.push({ folder, depth, path: here })
      walk(folder.id, depth + 1, here)
    }
  }
  walk(null, 1, '')
  return list
}

/**
 * Where a folder could be moved to: the top of its group, or another folder, never inside
 * itself, and never so deep that it (or what is in it) goes past the deepest level.
 */
export function moveTargets(folder: Folder, folders: Folder[]): FolderChoice[] {
  const inside = new Set([folder.id, ...descendantsOf(folder.id, folders).map((one) => one.id)])
  const height = 1 + levelsBelow(folder.id, folders)
  return treeOrder(folders).filter((choice) => !inside.has(choice.folder.id) && choice.depth + height <= MAX_FOLDER_DEPTH)
}

/** Whether a new folder fits inside this one (null: at the top of the group, always). */
export const roomInside = (folderId: string | null, folders: Folder[]) => folderId === null || depthOf(folderId, folders) < MAX_FOLDER_DEPTH
