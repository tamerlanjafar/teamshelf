import { useSpaceMembersIfLoaded } from '@/api/spaces'
import { isAdmin } from '@/lib/roles'
import type { Link, SpaceRole } from '@/lib/types'
import { useMe } from './org-context'

/**
 * What the signed-in person may do in the open organization. The database enforces all of it.
 * This only decides which buttons to show.
 *
 * Inside a space, its admins do everything: add links straight to the board, edit, delete,
 * review suggestions, manage groups, its people and its settings. Anyone in the organization can
 * create a space, and runs it. The organization's admins manage its people and its settings, but
 * run only the spaces they are admins of.
 */
export function usePermissions() {
  const me = useMe()
  const rows = useSpaceMembersIfLoaded()

  const roleIn = (spaceId: string | undefined | null): SpaceRole | null => rows.find((row) => row.space_id === spaceId && row.member_id === me.id)?.role ?? null
  const isSpaceAdmin = (spaceId: string | undefined | null) => Boolean(spaceId) && roleIn(spaceId) === 'admin'

  return {
    /** An admin of the organization: manages its people and its settings. */
    admin: isAdmin(me),
    roleIn,
    isSpaceAdmin,
    /** Reviews suggestions in at least one space. */
    reviewer: rows.some((row) => row.member_id === me.id && row.role === 'admin'),
    /** Edit, delete, approve or reject this link. */
    canManage: (link: Link) => isSpaceAdmin(link.space_id),
  }
}
