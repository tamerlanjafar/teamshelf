import { useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
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
