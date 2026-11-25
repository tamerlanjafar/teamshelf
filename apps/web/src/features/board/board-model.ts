// Turns groups, links and one person's preferences into what the board draws. Pure functions, no React.

import { childrenOf } from '@/features/folders/folder-tree'
import { personalOrder, teamOrder } from '@/lib/order'
import type { BoardPrefs, Folder, Group, Link } from '@/lib/types'

export interface BoardLink {
  link: Link
  /** The person hid this link itself (not just its group). */
  hidden: boolean
}

export interface BoardCard {
  group: Group
  /** Every link the card shows, in or out of folders, in order. */
  links: BoardLink[]
  /** The group's folders. Which of them show is up to the tree (see cardTree). */
  folders: Folder[]
  /** The person hid the whole group. */
  hidden: boolean
  /** The person arranged this group's links themselves, so the team's order doesn't apply to it. */
  ownLinkOrder: boolean
}

/**
 * What the board shows. "board": everything the person hasn't hidden.
 * "hidden": only what they hid, so it is easy to look through and bring back.
 */
export type BoardView = 'board' | 'hidden'

/** Every group in the order this person sees: their own if they made one, otherwise the team's. */
export function orderedGroups(groups: Group[], prefs: BoardPrefs): Group[] {
  return personalOrder(teamOrder(groups, (a, b) => a.name.localeCompare(b.name)), prefs.group_order)
}

/** When a link reached the board: when it was approved, or added directly. */
const arrivedAt = (link: Link) => link.reviewed_at ?? link.created_at

/** Oldest first, so a new link goes to the end of its group. */
const byArrival = (a: Link, b: Link) => arrivedAt(a).localeCompare(arrivedAt(b)) || a.title.localeCompare(b.title)

/** Every link of a group in the order this person sees. */
export function orderedLinks(links: Link[], groupId: string, prefs: BoardPrefs): Link[] {
  const ofGroup = links.filter((link) => link.group_id === groupId)
  return personalOrder(teamOrder(ofGroup, byArrival), prefs.link_order[groupId])
}

export interface BoardOptions {
  view: BoardView
  /** Keep groups without links (for a space admin, who can add to them). */
  keepEmpty: boolean
}

export function buildBoard(groups: Group[], links: Link[], prefs: BoardPrefs, { view, keepEmpty }: BoardOptions, folders: Folder[] = []): BoardCard[] {
  const hiddenGroups = new Set(prefs.hidden_groups)
  const hiddenLinks = new Set(prefs.hidden_links)

  return orderedGroups(groups, prefs)
    .map((group): BoardCard => {
      const groupHidden = hiddenGroups.has(group.id)
      const shown = orderedLinks(links, group.id, prefs)
        .map((link) => ({ link, hidden: hiddenLinks.has(link.id) }))
        // The board leaves out hidden links. The hidden view shows a hidden group whole,
        // and of the other groups only the links that were hidden one by one.
        .filter((item) => (view === 'board' ? !item.hidden : groupHidden || item.hidden))
      return { group, links: shown, folders: folders.filter((folder) => folder.group_id === group.id), hidden: groupHidden, ownLinkOrder: Boolean(prefs.link_order[group.id]?.length) }
    })
    .filter((card) => (view === 'board' ? !card.hidden : card.hidden || card.links.length > 0))
    .filter((card) => card.links.length > 0 || (view === 'hidden' ? card.hidden : keepEmpty))
}

/** A folder as a card draws it: what is right inside it, and how many links it holds at any depth. */
export interface FolderNode {
  folder: Folder
  folders: FolderNode[]
  links: BoardLink[]
  count: number
}

/** What a card draws: its folders (by name) and then the links at the top of the group. */
export interface CardTree {
  folders: FolderNode[]
  links: BoardLink[]
}

/**
 * A card's links in its folders. A folder with nothing shown in it is left out, unless
 * `keepEmpty` (the space's admins on the board, who can add to it).
 */
export function cardTree(card: BoardCard, keepEmpty: boolean): CardTree {
  const known = new Set(card.folders.map((folder) => folder.id))
  // A link whose folder isn't there (gone, or not loaded yet) shows at the top of the group.
  const placeOf = (item: BoardLink) => (item.link.folder_id && known.has(item.link.folder_id) ? item.link.folder_id : null)
  const linksIn = (folderId: string | null) => card.links.filter((item) => placeOf(item) === folderId)
  const build = (parentId: string | null, seen: Set<string>): FolderNode[] =>
    childrenOf(parentId, card.folders)
      .filter((folder) => !seen.has(folder.id))
      .map((folder) => {
        const folders = build(folder.id, new Set([...seen, folder.id]))
        const links = linksIn(folder.id)
        return { folder, folders, links, count: links.length + folders.reduce((sum, child) => sum + child.count, 0) }
      })
      .filter((node) => keepEmpty || node.count > 0)
  return { folders: build(null, new Set()), links: linksIn(null) }
}

/** The ids of the links right inside one folder of a card (null: at its top), in order. */
export const linkIdsIn = (card: BoardCard, folderId: string | null) => {
  const known = new Set(card.folders.map((folder) => folder.id))
  return card.links.filter((item) => (item.link.folder_id && known.has(item.link.folder_id) ? item.link.folder_id : null) === folderId).map((item) => item.link.id)
}

/** One line of a card: one link or file. */
export interface BoardRow {
  /** The link's id. */
  id: string
  /** The link's name, as it was written. */
  title: string
  item: BoardLink
}

/** The lines of a card, one per link, in the order of its links. */
export function rowsOf(card: BoardCard): BoardRow[] {
  return card.links.map((item) => ({ id: item.link.id, title: item.link.title, item }))
}

/** How many groups and links the person hid, counting only ones that still exist. */
export function countHidden(groups: Group[], links: Link[], prefs: BoardPrefs): number {
  const groupIds = new Set(groups.map((group) => group.id))
  const linkIds = new Set(links.map((link) => link.id))
  return prefs.hidden_groups.filter((id) => groupIds.has(id)).length + prefs.hidden_links.filter((id) => linkIds.has(id)).length
}

/** A rough height for a card, enough to balance the columns before anything is measured. Long cards stop at about 16 lines and scroll (see CAPPED in group-card.tsx). */
export const estimateCardHeight = (card: BoardCard, maxLines = 16) => {
  // Folders are open unless someone closed them: a line per folder, and every link.
  const folderLines = (nodes: FolderNode[]): number => nodes.reduce((sum, node) => sum + 1 + folderLines(node.folders), 0)
  const lines = folderLines(cardTree(card, true).folders) + card.links.length
  return 62 + Math.min(Math.max(lines, 1), maxLines) * 37
}

