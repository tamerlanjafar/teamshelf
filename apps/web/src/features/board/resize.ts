// Resizing cards: a card's height by its bottom edge, a column's width by the right edge of a
// card in it. While the pointer moves, only the page's styles change (once per frame), so React
// doesn't draw the board again on every move. The new size is saved once, when the pointer is let go.

import type { KeyboardEvent, PointerEvent } from 'react'

/** The fewest pixels a card's list keeps, so one line still shows. */
const MIN_LIST = 40
/** The narrowest a column with cards gets. */
export const MIN_COLUMN = 200
/** Drawn as high as this, a list shows everything it has (and whatever is added later). */
export const WHOLE_LIST = 4000
/** How far one press of an arrow key resizes. */
const KEY_STEP = 32

/** A card's list height as saved: whole pixels, within limits. */
export const tidyHeight = (height: number) => Math.round(Math.min(Math.max(height, MIN_LIST), WHOLE_LIST))

/** Column widths as saved: each one's share of the board, to 4 digits. */
export const tidyWidths = (widths: number[]) => {
  const total = widths.reduce((sum, width) => sum + width, 0)
  return widths.map((width) => Math.round((width / total) * 10000) / 10000)
}

/** The CSS variable a card's list takes its height from. */
export const HEIGHT_VAR = '--card-h'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * Follows the pointer from a handle until it is let go: `onMove` gets how far it moved, at most
 * once a frame; `onEnd` whether it was let go (true) or the drag was cancelled.
 */
function follow(event: PointerEvent<HTMLElement>, cursor: string, onMove: (dx: number, dy: number) => void, onEnd: (done: boolean) => void) {
  const handle = event.currentTarget
  const { pointerId, clientX: startX, clientY: startY } = event
  handle.setPointerCapture(pointerId)
  // The resize cursor everywhere while dragging, and no text gets selected.
  const page = document.documentElement.style
  const before = { cursor: page.cursor, userSelect: page.userSelect }
  page.cursor = cursor
  page.userSelect = 'none'

  let frame = 0
  let last = { x: startX, y: startY }
  const move = (moved: globalThis.PointerEvent) => {
    last = { x: moved.clientX, y: moved.clientY }
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      onMove(last.x - startX, last.y - startY)
    })
  }
  const end = (ended: globalThis.PointerEvent) => {
    cancelAnimationFrame(frame)
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
    page.cursor = before.cursor
    page.userSelect = before.userSelect
    if (ended.type === 'pointerup') onMove(last.x - startX, last.y - startY)
    onEnd(ended.type === 'pointerup')
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

/** The longest a card's list can be: all of it. */
const wholeHeight = (list: HTMLElement) => list.scrollHeight

/** Drags a card's bottom edge: its list grows or shrinks, up to showing all of it. */
export function dragHeight(event: PointerEvent<HTMLElement>, list: HTMLElement, save: (height: number) => void) {
  if (event.button !== 0) return
  // Not the start of moving the card or a link.
  event.preventDefault()
  event.stopPropagation()
  const before = list.style.getPropertyValue(HEIGHT_VAR)
  const start = list.clientHeight
  const whole = wholeHeight(list)
  let height = start
  follow(
    event,
    'ns-resize',
    (_dx, dy) => {
      height = Math.round(clamp(start + dy, Math.min(MIN_LIST, whole), whole))
      list.style.setProperty(HEIGHT_VAR, `${height}px`)
    },
    (done) => {
      if (!done || Math.abs(height - start) < 2) return list.style.setProperty(HEIGHT_VAR, before)
      // Pulled to the end of the list: it shows all of it from now on, also links added later.
      const saved = height >= whole - 2 ? WHOLE_LIST : tidyHeight(height)
      list.style.setProperty(HEIGHT_VAR, `${saved}px`)
      save(saved)
    },
  )
}

/** The columns of the board a column is in, and where it is among them. */
function columnsAround(column: HTMLElement) {
  const columns = [...(column.parentElement?.children ?? [])].filter((child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-column'))
  return { columns, index: columns.indexOf(column) }
}

/** How narrow a column may get: an empty one (no cards) all the way, so the cards beside it can take its room. */
const minWidth = (column: HTMLElement) => (column.querySelector('[data-card]') ? MIN_COLUMN : 0)

/** Gives the columns these widths, as shares of the board, the way React draws them once saved. */
function setWidths(columns: HTMLElement[], widths: number[]) {
  columns.forEach((column, index) => (column.style.flexGrow = String(widths[index])))
}

/** Which side of a column an edge is on. */
export type Side = 'left' | 'right'

/** The first of the two columns an edge sits between, or -1 when it is the board's own edge. */
function edgeBetween(column: HTMLElement, side: Side) {
  const { columns, index } = columnsAround(column)
  // Columns left out of the board (empty ones narrowed to nothing) are skipped: the edge is
  // between this column and the next one that shows.
  const shows = (place: number) => columns[place].getClientRects().length > 0
  let other = index
  do other += side === 'left' ? -1 : 1
  while (other >= 0 && other < columns.length && !shows(other))
  const outside = index === -1 || other < 0 || other >= columns.length
  return { columns, a: outside ? -1 : Math.min(index, other), b: outside ? -1 : Math.max(index, other) }
}
/**
 * Drags the left or right edge of a card: the two columns on either side of that edge share their
 * width differently, one getting wider as the other gets narrower.
 */
export function dragWidth(event: PointerEvent<HTMLElement>, column: HTMLElement, side: Side, save: (widths: number[]) => void) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const { columns, a, b } = edgeBetween(column, side)
  if (a === -1) return
  const before = columns.map((one) => one.style.flexGrow)
  const start = columns.map((one) => one.getBoundingClientRect().width)
  const pair = start[a] + start[b]
  const widths = [...start]
  setWidths(columns, widths)
  follow(
    event,
    'ew-resize',
    (dx) => {
      widths[a] = clamp(start[a] + dx, minWidth(columns[a]), pair - minWidth(columns[b]))
      widths[b] = pair - widths[a]
      setWidths(columns, widths)
    },
    (done) => {
      if (!done || Math.abs(widths[a] - start[a]) < 2) return columns.forEach((one, place) => (one.style.flexGrow = before[place]))
      const saved = tidyWidths(widths)
      setWidths(columns, saved)
      save(saved)
    },
  )
}

/** Resizing with the keyboard: arrows resize, Home goes back to the usual size. */
export function heightKeys(event: KeyboardEvent<HTMLElement>, list: HTMLElement, save: (height: number | undefined) => void) {
  const step = event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : 0
  if (event.key === 'Home') {
    event.preventDefault()
    return save(undefined)
  }
  if (!step) return
  event.preventDefault()
  const whole = wholeHeight(list)
  const height = clamp(list.clientHeight + step, Math.min(MIN_LIST, whole), whole)
  save(height >= whole - 2 ? WHOLE_LIST : tidyHeight(height))
}

/** Arrows move the edge that way. */
export function widthKeys(event: KeyboardEvent<HTMLElement>, column: HTMLElement, side: Side, save: (widths: number[] | undefined) => void) {
  const step = event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0
  if (event.key === 'Home') {
    event.preventDefault()
    return save(undefined)
  }
  if (!step) return
  event.preventDefault()
  const { columns, a, b } = edgeBetween(column, side)
  if (a === -1) return
  const widths = columns.map((one) => one.getBoundingClientRect().width)
  const pair = widths[a] + widths[b]
  widths[a] = clamp(widths[a] + step, minWidth(columns[a]), pair - minWidth(columns[b]))
  widths[b] = pair - widths[a]
  save(tidyWidths(widths))
}
