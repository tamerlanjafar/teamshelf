import { Navigate, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSpaces, useSpacesIfLoaded } from '@/api/spaces'
import { useOrg } from '@/features/org/org-context'
import type { Space } from '@/lib/types'

// The open space is in the address (/caspiantech/design), so a reload or a shared address shows
// the same one. On pages without one (/caspiantech/team), it is the space you had open last in
// this browser, or else the first one.

const rememberedKey = (orgId: string) => `teamshelf:space:${orgId}`

function remembered(orgId: string): string | null {
  try {
    return localStorage.getItem(rememberedKey(orgId))
  } catch {
    return null
  }
}

function pick(spaces: Space[], wanted: string | undefined, orgId: string): Space | null {
  return spaces.find((space) => space.slug === wanted) ?? spaces.find((space) => space.slug === remembered(orgId)) ?? spaces[0] ?? null
}

/** The space's slug in the address, if the page has one. */
export const useSpaceParam = (): string | undefined => (useParams({ strict: false }) as { space?: string }).space

/** The open space. Suspends until the spaces are loaded. Null when this person sees no space at all. */
export function useCurrentSpace(): Space | null {
  const org = useOrg()
  const space = pick(useSpaces(), useSpaceParam(), org.id)
  useRemember(org.id, space)
  return space
}

/** The open space, or null while the spaces load. */
export function useCurrentSpaceIfLoaded(): Space | null {
  const org = useOrg()
  return pick(useSpacesIfLoaded(), useSpaceParam(), org.id)
}

function useRemember(orgId: string, space: Space | null) {
  useEffect(() => {
    if (!space) return
    try {
      localStorage.setItem(rememberedKey(orgId), space.slug)
    } catch {
      // Private windows may refuse. The address still says which space is open.
    }
  }, [orgId, space])
}

/** Opens a space's board, or its settings. Without a space: the one open last, or the first. */
export function useOpenSpace() {
  const org = useOrg()
  const navigate = useNavigate()
  return (space: Pick<Space, 'slug'> | null, page: 'board' | 'settings' = 'board') => {
    if (!space) return navigate({ to: '/$org', params: { org: org.slug } })
    if (page === 'settings') return navigate({ to: '/$org/$space/settings', params: { org: org.slug, space: space.slug } })
    return navigate({ to: '/$org/$space', params: { org: org.slug, space: space.slug } })
  }
}

/**
 * Sends the organization's own address (/caspiantech) to a space's board. When nobody can see
 * a space, the board shows that instead (under a space name that matches none).
 */
export function OpenRememberedSpace() {
  const org = useOrg()
  // Suspends until the spaces are loaded.
  const space = pick(useSpaces(), undefined, org.id)
  return <Navigate to="/$org/$space" params={{ org: org.slug, space: space?.slug ?? 'none' }} replace />
}

/**
 * On a board whose address names a space that isn't there (deleted, renamed, or private), goes
 * to the space that is shown instead, so the address says what the page shows.
 */
export function useCorrectSpaceAddress(space: Space | null) {
  const org = useOrg()
  const wanted = useSpaceParam()
  const navigate = useNavigate()
  useEffect(() => {
    if (space && wanted && wanted !== space.slug) navigate({ to: '/$org/$space', params: { org: org.slug, space: space.slug }, replace: true })
  }, [space, wanted, org.slug, navigate])
}
