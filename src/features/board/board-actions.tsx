import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useGroupsIfLoaded, useSetTeamGroupOrder } from '@/api/groups'
import { useBoardLinksIfLoaded, useSetTeamLinkOrder } from '@/api/links'
import { useSaveBoardPrefs } from '@/api/prefs'
import { toastError } from '@/lib/errors'
import { mergeOrder } from '@/lib/order'
import type { BoardPrefs } from '@/lib/types'
import { orderedGroups, orderedLinks } from './board-model'
import { useEffectiveBoardPrefs, useHasOwnOrder } from './use-board-prefs'

interface BoardActions {
  prefs: BoardPrefs
  /** Dragging is off while the board is filtered: a place among some of the links isn't a place among all. */
  canReorder: boolean
  /** Saves a new order of the groups: the ids of the groups on screen, as they now stand. */
  reorderGroups: (visibleIds: string[]) => void
  /** Saves a new order of one group's links: the ids of its links on screen, as they now stand. */
  reorderLinks: (groupId: string, visibleIds: string[]) => void
  setGroupHidden: (groupId: string, hidden: boolean) => void
  setLinkHidden: (linkId: string, hidden: boolean) => void
  /** Go back to the team's order: of the groups, or of one group's links. */
  useTeamGroupOrder: () => void
  useTeamLinkOrder: (groupId: string) => void
}

const BoardActionsContext = createContext<BoardActions | null>(null)

export function useBoardActions() {
  const actions = useContext(BoardActionsContext)
  if (!actions) throw new Error('useBoardActions needs a BoardActionsProvider above it.')
  return actions
}

const toggled = (ids: string[], id: string, on: boolean) => (on ? [...new Set([...ids, id])] : ids.filter((other) => other !== id))
const without = <Value,>(record: Record<string, Value>, key: string) => Object.fromEntries(Object.entries(record).filter(([other]) => other !== key))

/**
 * Hiding and reordering on the board.
 *
 * Hiding is always personal. Reordering depends on who drags: the super admin changes the
 * team's order, which everyone follows who hasn't made their own. With personal ordering
 * switched on (see lib/features.ts) everyone else changes their own order, of the groups or
 * of the one group they dragged in. With it off, only the super admin can drag.
 */
export function BoardActionsProvider({ canReorder, children }: { canReorder: boolean; children: ReactNode }) {
  const ownOrder = useHasOwnOrder()
  const groups = useGroupsIfLoaded()
  const links = useBoardLinksIfLoaded()
  const prefs = useEffectiveBoardPrefs()
  const savePrefs = useSaveBoardPrefs()
  const setTeamGroupOrder = useSetTeamGroupOrder()
  const setTeamLinkOrder = useSetTeamLinkOrder()

  const actions = useMemo<BoardActions>(() => {
    const save = (changes: Partial<BoardPrefs>) => savePrefs.mutate(changes, { onError: toastError })

    return {
      prefs,
      canReorder,
      reorderGroups: (visibleIds) => {
        const ids = mergeOrder(orderedGroups(groups, prefs).map((group) => group.id), visibleIds)
        if (ownOrder) save({ group_order: ids })
        else setTeamGroupOrder.mutate(ids, { onError: toastError })
      },
      reorderLinks: (groupId, visibleIds) => {
        const ids = mergeOrder(orderedLinks(links, groupId, prefs).map((link) => link.id), visibleIds)
        if (ownOrder) save({ link_order: { ...prefs.link_order, [groupId]: ids } })
        else setTeamLinkOrder.mutate({ groupId, ids }, { onError: toastError })
      },
      setGroupHidden: (groupId, hidden) => save({ hidden_groups: toggled(prefs.hidden_groups, groupId, hidden) }),
      setLinkHidden: (linkId, hidden) => save({ hidden_links: toggled(prefs.hidden_links, linkId, hidden) }),
      useTeamGroupOrder: () => save({ group_order: [] }),
      useTeamLinkOrder: (groupId) => save({ link_order: without(prefs.link_order, groupId) }),
    }
    // The mutation objects change on every render, their `mutate` functions don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownOrder, groups, links, prefs, canReorder])

  return <BoardActionsContext value={actions}>{children}</BoardActionsContext>
}
