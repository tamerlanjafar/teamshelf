import type { Color } from './types'

/** The same colors as Workroom's workspace colors. */
export const COLORS: Record<Color, string> = {
  blue: '#337afa',
  indigo: '#5c5ce6',
  purple: '#9e59e6',
  pink: '#f55494',
  red: '#f04a45',
  orange: '#fa8c29',
  yellow: '#f2bd1a',
  green: '#33bd66',
  teal: '#1fadb8',
  graphite: '#737885',
}

export const COLOR_NAMES = Object.keys(COLORS) as Color[]

export const colorValue = (color: string) => COLORS[color as Color] ?? COLORS.graphite

/** A color for a new group that the existing groups use least. */
export function leastUsedColor(used: string[]): Color {
  const candidates = COLOR_NAMES.filter((name) => name !== 'graphite')
  const count = (name: string) => used.filter((color) => color === name).length
  return candidates.reduce((best, name) => (count(name) < count(best) ? name : best))
}
