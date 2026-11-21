import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

/** The board's column width and gap. */
export const COLUMN_WIDTH = 260
export const COLUMN_GAP = 10

/** How many columns of at least `minColumnWidth` fit in the element. 0 until it is measured. */
export function useColumnCount(container: RefObject<HTMLElement | null>, minColumnWidth = COLUMN_WIDTH, gap = COLUMN_GAP) {
  const [count, setCount] = useState(0)
  useLayoutEffect(() => {
    const node = container.current
    if (!node) return
    const update = () => setCount(Math.max(1, Math.floor((node.clientWidth + gap) / (minColumnWidth + gap))))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [container, minColumnWidth, gap])
  return count
}

interface MasonryProps<Item> {
  items: Item[]
  getKey: (item: Item) => string
  /** Used to decide which column is the shortest so far. It only has to be roughly right. */
  estimateHeight: (item: Item) => number
  renderItem: (item: Item) => ReactNode
  minColumnWidth?: number
  gap?: number
}

/**
 * A Pinterest-style grid: as many equal columns as fit, and each item goes into the column
 * that is shortest so far, so items keep their own height and their reading order.
 */
export function Masonry<Item>({ items, getKey, estimateHeight, renderItem, minColumnWidth = COLUMN_WIDTH, gap = COLUMN_GAP }: MasonryProps<Item>) {
  const container = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(container, minColumnWidth, gap)

  const columns = distribute(items, columnCount, estimateHeight, gap)

  return (
    <div ref={container} className="flex items-start" style={{ gap }}>
      {columns.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
          {column.map((item) => (
            <div key={getKey(item)}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function distribute<Item>(items: Item[], columnCount: number, estimateHeight: (item: Item) => number, gap: number): Item[][] {
  // Before the first measurement there are no columns, and nothing is drawn.
  if (columnCount === 0) return []
  const columns = Array.from({ length: columnCount }, () => ({ height: 0, items: [] as Item[] }))
  for (const item of items) {
    const shortest = columns.reduce((best, column) => (column.height < best.height ? column : best))
    shortest.items.push(item)
    shortest.height += estimateHeight(item) + gap
  }
  return columns.map((column) => column.items)
}
