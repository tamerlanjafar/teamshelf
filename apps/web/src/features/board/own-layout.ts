// A person's own arrangement of one space's board, and going back to the space's default. Pure functions, no React.
//
// A space has a default layout, built by its admins: the columns its cards stand in
// (`spaces.layout`), the sizes of cards and columns (`spaces.card_sizes`), and the order of each
// group's links (`links.position`). Anyone can rearrange their own board. What they changed is
// kept in their preferences and wins over the default, for them only.

import type { BoardPrefs } from '@/lib/types'

/** The parts of a person's preferences that arrange a board. Hiding is not one of them. */
export type Arrangement = Pick<BoardPrefs, 'group_order' | 'group_layout' | 'link_order' | 'card_sizes'>

const hasSizes = (sizes: BoardPrefs['card_sizes'][string] | undefined) => Boolean(sizes && ((sizes.heights && Object.keys(sizes.heights).length > 0) || sizes.widths))

/** Whether this person arranged anything of the space themselves: its columns, a size, or the links of one of its groups. */
export function hasOwnArrangement(prefs: BoardPrefs, spaceId: string, groupIds: string[]): boolean {
  const groups = new Set(groupIds)
  return (
    Boolean(prefs.group_layout[spaceId]?.length) ||
    hasSizes(prefs.card_sizes[spaceId]) ||
    prefs.group_order.some((id) => groups.has(id)) ||
    Object.entries(prefs.link_order).some(([groupId, ids]) => groups.has(groupId) && ids.length > 0)
  )
}

const without = <Value>(record: Record<string, Value>, drop: (key: string) => boolean) => Object.fromEntries(Object.entries(record).filter(([key]) => !drop(key)))

/** The person's arrangement with everything of this space taken out: its board follows the default again. Other spaces keep theirs. */
export function withoutOwnArrangement(prefs: BoardPrefs, spaceId: string, groupIds: string[]): Arrangement {
  const groups = new Set(groupIds)
  return {
    group_order: prefs.group_order.filter((id) => !groups.has(id)),
    group_layout: without(prefs.group_layout, (key) => key === spaceId),
    link_order: without(prefs.link_order, (key) => groups.has(key)),
    card_sizes: without(prefs.card_sizes, (key) => key === spaceId),
  }
}

/** The arranging parts of a person's preferences, to put back after a reset is undone. */
export const arrangementOf = (prefs: BoardPrefs): Arrangement => ({ group_order: prefs.group_order, group_layout: prefs.group_layout, link_order: prefs.link_order, card_sizes: prefs.card_sizes })
