import { useMemo } from 'react'
import { useBoardPrefsIfLoaded } from '@/api/prefs'
import { NO_PREFS, type BoardPrefs } from '@/lib/types'
import { useLayoutEditor } from './layout-editor'

/**
 * The preferences the board is drawn with: this person's own. While the space's default layout
 * is being edited, none of theirs: the board shows the default as everyone gets it (nothing
 * hidden, nothing of their own), with the links in the order the draft gives them.
 */
export function useEffectiveBoardPrefs(): BoardPrefs {
  const prefs = useBoardPrefsIfLoaded()
  const { draft } = useLayoutEditor()
  const drafted = draft?.linkOrder
  return useMemo(() => (drafted ? { ...NO_PREFS, link_order: drafted } : prefs), [prefs, drafted])
}
