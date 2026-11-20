import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMe } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import { NO_PREFS, type BoardPrefs } from '@/lib/types'
import { unwrap } from './db'

const prefsKey = (memberId: string) => [memberId, 'prefs'] as const

/** A member's own arrangement of their organization's board: what they hid and what they reordered. */
export const boardPrefsQuery = (memberId: string) =>
  queryOptions({
    queryKey: prefsKey(memberId),
    staleTime: Infinity,
    queryFn: async (): Promise<BoardPrefs> => {
      const row = await unwrap<BoardPrefs | null>(neon.from('member_prefs').select('group_order,group_layout,link_order,hidden_groups,hidden_links,recent_links').eq('member_id', memberId).maybeSingle())
      return row ?? NO_PREFS
    },
  })

/** Your preferences. Suspends until they are loaded, so nothing you hid flashes by: use it inside a <Section>. */
export const useBoardPrefs = () => useSuspenseQuery(boardPrefsQuery(useMe().id)).data

/** Your preferences, or none while they load. */
export const useBoardPrefsIfLoaded = (): BoardPrefs => useQuery(boardPrefsQuery(useMe().id)).data ?? NO_PREFS

/** Changes some of your preferences. The board shows the change at once and saves it in the background. */
export function useSaveBoardPrefs() {
  const me = useMe()
  const queryClient = useQueryClient()
  const key = prefsKey(me.id)

  return useMutation({
    mutationFn: (changes: Partial<BoardPrefs>) => {
      const next = { ...NO_PREFS, ...queryClient.getQueryData<BoardPrefs>(key), ...changes }
      return unwrap(neon.from('member_prefs').upsert({ member_id: me.id, ...next, updated_at: new Date().toISOString() }))
    },
    onMutate: (changes) => {
      const before = queryClient.getQueryData<BoardPrefs>(key)
      queryClient.setQueryData<BoardPrefs>(key, { ...NO_PREFS, ...before, ...changes })
      return { before }
    },
    onError: (_error, _changes, context) => queryClient.setQueryData(key, context?.before),
  })
}
