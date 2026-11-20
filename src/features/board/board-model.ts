// Turns groups, links and one person's preferences into what the board draws. Pure functions, no React.

import { compareEnvironments, splitName } from '@/lib/environments'
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
  /** Words that must all appear in a link's group, name or address. */
  query: string
  /** Show only links of these categories. None: links of every category, and those without one. */
  categoryIds: string[]
}

/**
 * What the board shows. "board": everything the person hasn't hidden.
 * "hidden": only what they hid, so it is easy to look through and bring back.
 */
export type BoardView = 'board' | 'hidden'

export const isFiltering = (filter: BoardFilter) => Boolean(filter.query.trim() || filter.categoryIds.length)

function matches(link: Link, group: Group, filter: BoardFilter) {
  if (filter.categoryIds.length && !filter.categoryIds.includes(link.category_id ?? '')) return false
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = `${group.name} ${link.title} ${link.url}`.toLowerCase()
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
  /** Keep groups without links (for the super admin, who can add to them) when nothing is filtered. */
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

/**
 * One line of a card. Links whose names differ only after the last " - " are one thing in
 * several environments ("Online WEB - Staging", "Online WEB - Prod"), and share a line:
 * the name once, and a small link per environment.
 */
export interface BoardRow {
  /** Stable while the row's links stay the same: the id of its first link. */
  id: string
  /** The name without the environment, and without the group's own name in front. */
  title: string
  links: { item: BoardLink; /** "Staging", "Prod"… or null for a link that has no environment in its name. */ environment: string | null }[]
}

/** "Jenkins Retail" on the Jenkins card reads "Retail". */
function withoutGroupName(title: string, groupName: string) {
  const prefix = `${groupName.trim().toLowerCase()} `
  return title.toLowerCase().startsWith(prefix) && title.length > prefix.length ? title.slice(prefix.length).trim() : title
}

/** The lines of a card, in the order of its links: a line sits where its first link is. */
export function rowsOf(card: BoardCard): BoardRow[] {
  const rows = new Map<string, BoardRow>()
  for (const item of card.links) {
    const { base, environment } = splitName(item.link.title)
    // A link without an environment is always a line of its own.
    const key = environment ? `env:${base.toLowerCase()}` : `link:${item.link.id}`
    const row = rows.get(key) ?? { id: item.link.id, title: withoutGroupName(base, card.group.name), links: [] }
    row.links.push({ item, environment })
    rows.set(key, row)
  }
  // Within a line the environments always come in the same order, from the safest to production.
  for (const row of rows.values()) row.links.sort((a, b) => compareEnvironments(a.environment ?? '', b.environment ?? ''))
  return [...rows.values()]
}

/** The category every link of the card has, if they all have the same one. It is then shown once, on the card. */
export function sharedCategoryId(card: BoardCard): string | null {
  const ids = new Set(card.links.map((item) => item.link.category_id))
  const [only] = ids
  return ids.size === 1 && only ? only : null
}

/** How many groups and links the person hid, counting only ones that still exist. */
export function countHidden(groups: Group[], links: Link[], prefs: BoardPrefs): number {
  const groupIds = new Set(groups.map((group) => group.id))
  const linkIds = new Set(links.map((link) => link.id))
  return prefs.hidden_groups.filter((id) => groupIds.has(id)).length + prefs.hidden_links.filter((id) => linkIds.has(id)).length
}

/** A rough height for a card, enough to balance the columns before anything is measured. */
export const estimateCardHeight = (card: BoardCard) => 62 + Math.max(rowsOf(card).length, 1) * 37
