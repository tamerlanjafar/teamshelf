import { useSyncExternalStore } from 'react'

// Which folders are open, remembered in this browser. Folders start closed. Opening one is a
// matter of how you look at the board, not part of it, so it isn't saved for the account.

const KEY = 'teamshelf.open-folders'
const listeners = new Set<() => void>()
let open: ReadonlySet<string> | null = null

function read(): ReadonlySet<string> {
  if (open) return open
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    open = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    open = new Set()
  }
  return open
}

const EMPTY: ReadonlySet<string> = new Set()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Opens or closes a folder. */
export function setFolderOpen(id: string, isOpen: boolean) {
  const next = new Set(read())
  if (isOpen) next.add(id)
  else next.delete(id)
  open = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // Not remembered (a private window, storage blocked): it still opens for now.
  }
  for (const listener of listeners) listener()
}

/** The open folders. Nothing is open while the public pages are drawn at build time. */
export const useOpenFolders = () => useSyncExternalStore(subscribe, read, () => EMPTY)
