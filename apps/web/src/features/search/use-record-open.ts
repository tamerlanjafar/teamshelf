import { useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { toast } from '@/components/ui/toast'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'

/** How many recently opened links are kept, per space. */
export const RECENT_LIMIT = 10

/** Remembers that this person opened a link, for "Recent" in the menus. Newest first, per space. */
export function useRecordOpen() {
  const prefs = useBoardPrefsIfLoaded()
  const savePrefs = useSaveBoardPrefs()
  return (link: Pick<Link, 'id' | 'space_id'>) => {
    const recent = [link.id, ...(prefs.recent_links[link.space_id] ?? []).filter((id) => id !== link.id)].slice(0, RECENT_LIMIT)
    savePrefs.mutate({ recent_links: { ...prefs.recent_links, [link.space_id]: recent } })
  }
}

/**
 * Takes links off this person's "Recent" in a space: one (`remove`), or all of them (`clear`,
 * which can be undone from its toast, the way a reset of the layout can).
 */
export function useForgetRecent() {
  const prefs = useBoardPrefsIfLoaded()
  const savePrefs = useSaveBoardPrefs()
  const save = (spaceId: string, ids: string[]) => {
    const { [spaceId]: _, ...others } = prefs.recent_links
    return { recent_links: ids.length ? { ...others, [spaceId]: ids } : others }
  }
  return {
    remove(link: Pick<Link, 'id' | 'space_id'>) {
      savePrefs.mutate(save(link.space_id, (prefs.recent_links[link.space_id] ?? []).filter((id) => id !== link.id)), { onError: toastError })
    },
    clear(spaceId: string) {
      const before = prefs.recent_links
      savePrefs.mutate(save(spaceId, []), {
        onError: toastError,
        onSuccess: () => toast('Recent links cleared', { action: { label: 'Undo', onClick: () => savePrefs.mutate({ recent_links: before }, { onError: toastError }) } }),
      })
    },
  }
}
