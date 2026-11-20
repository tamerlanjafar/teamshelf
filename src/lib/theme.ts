import { useSyncExternalStore } from 'react'

// The theme: light, dark, or whatever the system uses. The choice is kept in this browser.
// index.html applies it before the first paint with the same key.

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'linkboard-theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

let choice = read()

function apply() {
  const dark = choice === 'dark' || (choice === 'system' && systemDark.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

systemDark.addEventListener('change', apply)
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
  )
}
