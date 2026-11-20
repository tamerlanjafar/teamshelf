import { useMemo } from 'react'
import { useBoardPrefsIfLoaded } from '@/api/prefs'
import { useMe } from '@/features/org/org-context'
import { FEATURES } from '@/lib/features'
import { isSuperAdmin } from '@/lib/roles'
import type { BoardPrefs } from '@/lib/types'

/** Whether this person arranges the board for themselves only (and not for everyone, or not at all). */
export function useHasOwnOrder() {
  const me = useMe()
  return FEATURES.personalOrder && !isSuperAdmin(me)
}

/**
 * The preferences the board is drawn with. A person's own order only counts when personal
 * ordering is switched on, and never for the super admin, whose order is the team's.
 */
export function useEffectiveBoardPrefs(): BoardPrefs {
  const prefs = useBoardPrefsIfLoaded()
  const ownOrder = useHasOwnOrder()
  return useMemo(() => (ownOrder ? prefs : { ...prefs, group_order: [], link_order: {} }), [prefs, ownOrder])
}
