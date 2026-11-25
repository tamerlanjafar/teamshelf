import { useQueryClient } from '@tanstack/react-query'
import { useFoldersIfLoaded } from '@/api/folders'
import { boardPrefsQuery, useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { useMe } from '@/features/org/org-context'
import { toastError } from '@/lib/errors'
import { NO_PREFS, type BoardPrefs } from '@/lib/types'

// Folders are open, for everyone and from the start (a new one too). Which ones a person closed
// is kept with their preferences, so a folder they closed stays closed on every device they sign
// in on. Only they see it.

/** Whether a folder is open for this person, and the way to open or close one (shown at once, saved in the background). */
export function useOpenFolders() {
  const me = useMe()
  const queryClient = useQueryClient()
  const prefs = useBoardPrefsIfLoaded()
  const folders = useFoldersIfLoaded()
  const savePrefs = useSaveBoardPrefs()
  // A row saved before there was this column has none.
  const closed = new Set(prefs.closed_folders ?? [])

  function setFolderOpen(id: string, open: boolean) {
    // From what is saved (or shown) right now, so two folders closed in a row both stay closed.
    const current = queryClient.getQueryData<BoardPrefs>(boardPrefsQuery(me.id).queryKey)?.closed_folders ?? NO_PREFS.closed_folders
    if (current.includes(id) !== open) return
    // Folders that are gone (deleted, or in a space no longer open to them) are dropped on the way.
    const existing = new Set(folders.map((folder) => folder.id))
    const kept = current.filter((one) => one !== id && existing.has(one))
    savePrefs.mutate({ closed_folders: open ? kept : [...kept, id] }, { onError: toastError })
  }

  return { isOpen: (id: string) => !closed.has(id), setFolderOpen }
}
