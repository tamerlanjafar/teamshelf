// How numbers, sizes and dates read in the reports. Pure functions.

export const count = (value: number) => value.toLocaleString('en-US')

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-21" or a full timestamp → "21 Nov". The day is read as written, whatever the time zone here. */
export function day(value: string): string {
  const [, month, date] = /^\d{4}-(\d{2})-(\d{2})/.exec(value) ?? []
  return month ? `${Number(date)} ${MONTHS[Number(month) - 1]}` : value
}

/** How long ago, in the largest unit that fits: "today", "3 days ago", "2 months ago". */
export function ago(value: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} ${days < 60 ? 'month' : 'months'} ago`
  return `${Math.floor(days / 365)} ${days < 730 ? 'year' : 'years'} ago`
}

/** A share of a limit, as a whole percent that never rounds a little down to nothing or a lot up to full. */
export function share(used: number, limit: number): number {
  if (used <= 0) return 0
  if (used >= limit) return 100
  return Math.min(99, Math.max(1, Math.round((used / limit) * 100)))
}
