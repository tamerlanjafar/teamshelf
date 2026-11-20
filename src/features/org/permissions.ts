import { useSpaceMembersIfLoaded } from '@/api/spaces'
import { isAdmin, isSuperAdmin } from '@/lib/roles'
import type { Link, SpaceRole } from '@/lib/types'
import { useMe } from './org-context'

/**
 * What the signed-in person may do in the open organization. The database enforces all of it.
 * This only decides which buttons to show.
 *
 * Inside a space, its admins do everything: add links straight to the board, edit, delete,
 * review suggestions, manage groups, members and the space's settings. The organization's
 * super admin is an admin of every space. The organization's admins create spaces.
 */
export function usePermissions() {
  const me = useMe()
  const rows = useSpaceMembersIfLoaded()
  const superAdmin = isSuperAdmin(me)

  const roleIn = (spaceId: string | undefined | null): SpaceRole | null => rows.find((row) => row.space_id === spaceId && row.member_id === me.id)?.role ?? null
  const isSpaceAdmin = (spaceId: string | undefined | null) => Boolean(spaceId) && (superAdmin || roleIn(spaceId) === 'admin')

  return {
    superAdmin,
    /** An admin of the organization: manages its people, creates spaces. */
    admin: isAdmin(me),
    roleIn,
    isSpaceAdmin,
    /** Reviews suggestions in at least one space. */
    reviewer: superAdmin || rows.some((row) => row.member_id === me.id && row.role === 'admin'),
    /** Edit, delete, approve or reject this link. */
    canManage: (link: Link) => isSpaceAdmin(link.space_id),
  }
}
