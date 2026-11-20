import { useMemo } from 'react'
import { useBoardPrefsIfLoaded } from '@/api/prefs'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { FEATURES } from '@/lib/features'
import type { BoardPrefs } from '@/lib/types'

/** Whether this person arranges the open space's board for themselves only (and not for everyone, or not at all). */
export function useHasOwnOrder() {
  const { isSpaceAdmin } = usePermissions()
  const space = useCurrentSpaceIfLoaded()
  return FEATURES.personalOrder && !isSpaceAdmin(space?.id)
}

/**
 * The preferences the board is drawn with. A person's own order only counts when personal
 * ordering is switched on, and never for the space's admins, whose order is everyone's.
 */
export function useEffectiveBoardPrefs(): BoardPrefs {
  const prefs = useBoardPrefsIfLoaded()
  const ownOrder = useHasOwnOrder()
  return useMemo(() => (ownOrder ? prefs : { ...prefs, group_order: [], link_order: {} }), [prefs, ownOrder])
}
