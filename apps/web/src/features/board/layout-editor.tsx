import { useBlocker } from '@tanstack/react-router'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { groupsOf, useGroupsIfLoaded } from '@/api/groups'
import { useSetTeamLinkOrder } from '@/api/links'
import { useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { useSetSpaceCardSizes, useSetSpaceLayout } from '@/api/spaces'
import { errorMessage } from '@/lib/errors'
import type { CardSizes, Space } from '@/lib/types'
import { sameLayout, type Layout } from './board-layout'
import { hasOwnArrangement, withoutOwnArrangement } from './own-layout'

/**
 * The default layout of a space while one of its admins edits it: where its cards stand, the
 * order of the links they rearranged, and the sizes of cards and columns. Nothing of it is
 * saved, and nobody else sees it, until the admin saves.
 */
export interface LayoutDraft {
  layout: Layout
  /** The new order of the links, for each group whose links were rearranged. */
  linkOrder: Record<string, string[]>
  sizes: CardSizes
}

interface LayoutEditor {
  /** The draft while the default layout is being edited. Null the rest of the time. */
  draft: LayoutDraft | null
  /** Whether the draft differs from the space's layout. */
  dirty: boolean
  saving: boolean
  start: () => void
  change: (update: (draft: LayoutDraft) => LayoutDraft) => void
  /** Leaves the editor without saving. */
  discard: () => void
  /** Makes the draft the space's layout, for everyone, and leaves the editor. */
  save: () => void
}

const NOT_EDITING: LayoutEditor = { draft: null, dirty: false, saving: false, start: () => {}, change: () => {}, discard: () => {}, save: () => {} }

const LayoutEditorContext = createContext<LayoutEditor>(NOT_EDITING)

/** The editor of the open space's default layout. Outside a board there is none, and it never edits. */
export const useLayoutEditor = () => useContext(LayoutEditorContext)

const sameSizes = (a: CardSizes, b: CardSizes) => JSON.stringify(a.widths ?? null) === JSON.stringify(b.widths ?? null) && JSON.stringify(Object.entries(a.heights ?? {}).sort()) === JSON.stringify(Object.entries(b.heights ?? {}).sort())

/**
 * Holds the draft of a space's default layout while its admin edits it. Give it the space as
 * its `key`, so a draft never follows to another space.
 */
export function LayoutEditorProvider({ space, children }: { space: Space | null; children: ReactNode }) {
  const [draft, setDraft] = useState<LayoutDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const setSpaceLayout = useSetSpaceLayout()
  const setSpaceCardSizes = useSetSpaceCardSizes()
  const setLinkOrder = useSetTeamLinkOrder()
  const savePrefs = useSaveBoardPrefs()
  const prefs = useBoardPrefsIfLoaded()
  const groups = groupsOf(useGroupsIfLoaded(), space?.id)

  const layoutChanged = Boolean(draft && space && !sameLayout(draft.layout, space.layout ?? []))
  const sizesChanged = Boolean(draft && space && !sameSizes(draft.sizes, space.card_sizes ?? {}))
  const dirty = layoutChanged || sizesChanged || Object.keys(draft?.linkOrder ?? {}).length > 0

  // Leaving the page (or closing the tab) with unsaved changes asks first.
  useBlocker({
    shouldBlockFn: () => dirty && !saving && !window.confirm('Leave without saving? The space layout stays as it was.'),
    enableBeforeUnload: () => dirty,
    disabled: !dirty,
  })

  const start = useCallback(() => {
    if (space) setDraft({ layout: space.layout ?? [], linkOrder: {}, sizes: space.card_sizes ?? {} })
  }, [space])
  const change = useCallback((update: (draft: LayoutDraft) => LayoutDraft) => setDraft((current) => current && update(current)), [])
  const discard = useCallback(() => setDraft(null), [])

  const editor = useMemo<LayoutEditor>(() => {
    async function save() {
      if (!draft || !space || saving) return
      setSaving(true)
      try {
        if (layoutChanged) await setSpaceLayout.mutateAsync({ id: space.id, layout: draft.layout })
        if (sizesChanged) await setSpaceCardSizes.mutateAsync({ id: space.id, sizes: draft.sizes })
        for (const [groupId, ids] of Object.entries(draft.linkOrder)) await setLinkOrder.mutateAsync({ groupId, ids })
        // The admin sees what they just built: an arrangement of their own would hide it from them.
        const groupIds = groups.map((group) => group.id)
        if (hasOwnArrangement(prefs, space.id, groupIds)) await savePrefs.mutateAsync(withoutOwnArrangement(prefs, space.id, groupIds))
        setDraft(null)
        toast.success('Default layout saved')
      } catch (error) {
        toast.error("The layout couldn't be saved", { description: errorMessage(error) })
      } finally {
        setSaving(false)
      }
    }
    return { draft, dirty, saving, start, change, discard, save: () => void save() }
    // The mutation objects change on every render, their functions don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, saving, space, prefs, groups.length, layoutChanged, sizesChanged, start, change, discard])

  return <LayoutEditorContext value={editor}>{children}</LayoutEditorContext>
}
