// Turns groups, links and one person's preferences into what the board draws. Pure functions, no React.

import { withoutGroupName } from '@/lib/names'
import { personalOrder, teamOrder } from '@/lib/order'
import type { BoardPrefs, Group, Link } from '@/lib/types'

export interface BoardLink {
  link: Link
  /** The person hid this link itself (not just its group). */
  hidden: boolean
}

export interface BoardCard {
  group: Group
  links: BoardLink[]
  /** The person hid the whole group. */
  hidden: boolean
  /** The person arranged this group's links themselves, so the team's order doesn't apply to it. */
  ownLinkOrder: boolean
}

export interface BoardFilter {
  /** Words that must all appear in a link's group, name, address or file name. */
  query: string
}

/**
 * What the board shows. "board": everything the person hasn't hidden.
 * "hidden": only what they hid, so it is easy to look through and bring back.
 */
export type BoardView = 'board' | 'hidden'

export const isFiltering = (filter: BoardFilter) => Boolean(filter.query.trim())

function matches(link: Link, group: Group, filter: BoardFilter) {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = `${group.name} ${link.title} ${link.kind === 'file' ? (link.file_name ?? '') : link.url}`.toLowerCase()
  return words.every((word) => text.includes(word))
}

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
  filter: BoardFilter
  view: BoardView
  /** Keep groups without links (for a space admin, who can add to them) when nothing is filtered. */
  keepEmpty: boolean
}

export function buildBoard(groups: Group[], links: Link[], prefs: BoardPrefs, { filter, view, keepEmpty }: BoardOptions): BoardCard[] {
  const hiddenGroups = new Set(prefs.hidden_groups)
  const hiddenLinks = new Set(prefs.hidden_links)
  const filtering = isFiltering(filter)

  return orderedGroups(groups, prefs)
    .map((group): BoardCard => {
      const groupHidden = hiddenGroups.has(group.id)
      const shown = orderedLinks(links, group.id, prefs)
        .filter((link) => matches(link, group, filter))
        .map((link) => ({ link, hidden: hiddenLinks.has(link.id) }))
        // The board leaves out hidden links. The hidden view shows a hidden group whole,
        // and of the other groups only the links that were hidden one by one.
        .filter((item) => (view === 'board' ? !item.hidden : groupHidden || item.hidden))
      return { group, links: shown, hidden: groupHidden, ownLinkOrder: Boolean(prefs.link_order[group.id]?.length) }
    })
    .filter((card) => (view === 'board' ? !card.hidden : card.hidden || card.links.length > 0))
    .filter((card) => card.links.length > 0 || (view === 'hidden' ? card.hidden : keepEmpty && !filtering))
}

/** One line of a card: one link or file. */
export interface BoardRow {
  /** The link's id. */
  id: string
  /** The name, without the group's own name in front. */
  title: string
  item: BoardLink
}

/** The lines of a card, one per link, in the order of its links. */
export function rowsOf(card: BoardCard): BoardRow[] {
  return card.links.map((item) => ({ id: item.link.id, title: withoutGroupName(item.link.title, card.group.name), item }))
}

/** How many groups and links the person hid, counting only ones that still exist. */
export function countHidden(groups: Group[], links: Link[], prefs: BoardPrefs): number {
  const groupIds = new Set(groups.map((group) => group.id))
  const linkIds = new Set(links.map((link) => link.id))
  return prefs.hidden_groups.filter((id) => groupIds.has(id)).length + prefs.hidden_links.filter((id) => linkIds.has(id)).length
}

/** A rough height for a card, enough to balance the columns before anything is measured. Long cards stop at about 16 lines and scroll (see CAPPED in group-card.tsx). */
export const estimateCardHeight = (card: BoardCard, maxLines = 16) => {
  const lines = card.links.length
  return 62 + Math.min(Math.max(lines, 1), maxLines) * 37
}

