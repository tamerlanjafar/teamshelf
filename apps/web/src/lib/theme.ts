import { flushSync } from 'react-dom'
import { useSyncExternalStore } from 'react'

// The theme: light, dark, or whatever the system uses. The choice is kept in this browser.
// src/routes/__root.tsx applies it before the first paint with the same key. On the server
// (pages drawn at build time) there is no browser, and the theme is left to that script.

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'teamshelf-theme'
const inBrowser = typeof window !== 'undefined'
const systemDark = inBrowser ? window.matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  if (!inBrowser) return 'system'
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

let choice = read()

function apply() {
  if (!systemDark) return
  const dark = choice === 'dark' || (choice === 'system' && systemDark.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

systemDark?.addEventListener('change', apply)
apply()

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
  apply()
  for (const listener of listeners) listener()
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => choice,
    () => 'system',
  )
}

/** Whether a choice shows the dark theme now. */
const showsDark = (next: ThemeChoice) => next === 'dark' || (next === 'system' && systemDark?.matches === true)

/**
 * Changes the theme with the new one growing as a circle from `origin` (where it was clicked)
 * until it covers the page. Falls back to an instant change where the browser has no view
 * transitions, the person prefers less motion, or the page wouldn't look any different.
 */
export function setThemeFrom(next: ThemeChoice, origin: { x: number; y: number }) {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduced || showsDark(next) === showsDark(choice)) return setTheme(next)

  const { x, y } = origin
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  // flushSync: React draws the new choice before the browser takes the "after" picture.
  doc.startViewTransition(() => flushSync(() => setTheme(next))).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }, () => {})
}
