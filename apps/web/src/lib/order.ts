// Ordering of groups and links.
//
// There are two orders. The team's order is set by admins and stored on the rows (`position`).
// A person's own order is a list of ids in their preferences. A person who never rearranged
// something follows the team's order for it, also when an admin changes that order later.

interface Placed {
  id: string
  position: number | null
}

/**
 * The team's order: the items an admin has placed, by their position, and after them the ones
 * nobody has placed yet, in the order `compareUnplaced` gives.
 */
export function teamOrder<Item extends Placed>(items: Item[], compareUnplaced: (a: Item, b: Item) => number): Item[] {
  return [...items].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position
    if (a.position !== null) return -1
    if (b.position !== null) return 1
    return compareUnplaced(a, b)
  })
}

/**
 * A person's own order over items that are already in the team's order.
 * Items they never placed (added since) keep their team order, after the placed ones.
 */
export function personalOrder<Item extends { id: string }>(items: Item[], ownOrder: string[] | undefined): Item[] {
  if (!ownOrder?.length) return items
  const place = new Map(ownOrder.map((id, index) => [id, index]))
  const placed = items.filter((item) => place.has(item.id)).sort((a, b) => place.get(a.id)! - place.get(b.id)!)
  return [...placed, ...items.filter((item) => !place.has(item.id))]
}

/**
 * A new order for all the ids, after the ones on screen were rearranged. The ones on screen
 * (`visibleNow`, in their new order) take the places they had among all of them, and the
 * rest (hidden ones) stay where they were.
 */
export function mergeOrder(all: string[], visibleNow: string[]): string[] {
  const moved = new Set(visibleNow)
  let next = 0
  return all.map((id) => (moved.has(id) ? visibleNow[next++] : id))
}
