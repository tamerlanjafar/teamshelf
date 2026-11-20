// Ordering of groups and links.
//
// There are two orders. The team's order is set by admins and stored on the rows (`position`).
// A person's own order is a list of ids in their preferences. A person who never rearranged
// something follows the team's order for it, also when an admin changes that order later.

interface Placed {
  id: string
  position: number | null
}

/** The team's order: by position, then the ones without a position, by name. */
export function teamOrder<Item extends Placed>(items: Item[], nameOf: (item: Item) => string): Item[] {
  return [...items].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position
    if (a.position !== null) return -1
    if (b.position !== null) return 1
    return nameOf(a).localeCompare(nameOf(b))
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

/** The ids with `moved` taken out and put back just before or after `target`. */
export function moveId(ids: string[], moved: string, target: string, after: boolean): string[] {
  const rest = ids.filter((id) => id !== moved)
  const index = rest.indexOf(target)
  if (index === -1) return ids
  rest.splice(after ? index + 1 : index, 0, moved)
  return rest
}
