// Where each card of a board goes: which column, and where in it. Pure functions, no React.
//
// A layout is a list of columns, each a list of group ids from top to bottom. It is saved for
// the number of columns it was made on. On a screen with as many columns it is shown exactly.
// On a narrower one the cards are poured into fewer columns in reading order (by how far down
// they were), and on a wider one the extra columns start empty. Cards that aren't in the
// layout (new groups) go to the end of the shortest column.

export type Layout = string[][]

interface Card {
  id: string
  height: number
}

/** The columns to draw: the ids of the given cards, laid out in `count` columns. */
export function arrangeColumns(cards: Card[], layout: Layout, count: number, gap: number): Layout {
  if (count <= 0) return []
  const byId = new Map(cards.map((card) => [card.id, card]))
  const columns: { ids: string[]; height: number }[] = Array.from({ length: count }, () => ({ ids: [], height: 0 }))
  const add = (column: (typeof columns)[number], id: string) => {
    column.ids.push(id)
    column.height += byId.get(id)!.height + gap
  }
  const shortest = () => columns.reduce((best, column) => (column.height < best.height ? column : best))
  const placed = new Set<string>()

  const saved = layout.map((column) => column.filter((id) => byId.has(id) && !placed.has(id) && placed.add(id)))
  if (saved.length <= count) {
    saved.forEach((column, index) => column.forEach((id) => add(columns[index], id)))
  } else {
    // Fewer columns than the layout was made for: in the order of how far down each card starts.
    const tops = saved.flatMap((column) => {
      let top = 0
      return column.map((id, index) => {
        const entry = { id, top, index }
        top += byId.get(id)!.height + gap
        return entry
      })
    })
    tops.sort((a, b) => a.top - b.top || a.index - b.index)
    for (const { id } of tops) add(shortest(), id)
  }

  for (const card of cards) if (!placed.has(card.id)) add(shortest(), card.id)
  return columns.map((column) => column.ids)
}

/**
 * The layout to save after the cards on screen were arranged into `shown`. Cards that weren't
 * on screen (hidden by this person) keep the column and the place they had.
 */
export function mergeLayout(previous: Layout, shown: Layout): Layout {
  const onScreen = new Set(shown.flat())
  const next = shown.map((column) => [...column])
  previous.forEach((column, index) => {
    column.forEach((id, place) => {
      if (onScreen.has(id)) return
      const target = next[Math.min(index, next.length - 1)]
      if (target) target.splice(Math.min(place, target.length), 0, id)
    })
  })
  return next
}

/** Moves one card to another column, before `beforeId` (or at the end). */
export function moveCard(columns: Layout, id: string, toColumn: number, beforeId: string | null): Layout {
  const next = columns.map((column) => column.filter((other) => other !== id))
  const target = next[toColumn]
  const at = beforeId === null ? -1 : target.indexOf(beforeId)
  target.splice(at === -1 ? target.length : at, 0, id)
  return next
}

export const columnOf = (columns: Layout, id: string) => columns.findIndex((column) => column.includes(id))

export const sameLayout = (a: Layout, b: Layout) => a.length === b.length && a.every((column, index) => column.length === b[index].length && column.every((id, place) => id === b[index][place]))
