import { useCategoryManagersIfLoaded } from '@/api/categories'
import { isAdmin, isSuperAdmin } from '@/lib/roles'
import type { Link } from '@/lib/types'
import { useMe } from './org-context'

/**
 * What the signed-in person may do in the open organization. The database enforces all of it.
 * This only decides which buttons to show.
 *
 * Besides the role, a person can manage categories. In those they act like the super admin
 * for links: add straight to the board, edit, delete, and review suggestions.
 */
export function usePermissions() {
  const me = useMe()
  const managers = useCategoryManagersIfLoaded()
  const managedCategoryIds = managers.filter((row) => row.member_id === me.id).map((row) => row.category_id)

  const superAdmin = isSuperAdmin(me)
  const manages = (categoryId: string | null) => categoryId !== null && managedCategoryIds.includes(categoryId)

  return {
    superAdmin,
    admin: isAdmin(me),
    managedCategoryIds,
    /** Reviews suggestions, of everything or of some categories. */
    reviewer: superAdmin || managedCategoryIds.length > 0,
    /** A link added in this category goes straight to the board, instead of waiting for review. */
    canPublishIn: (categoryId: string | null) => superAdmin || manages(categoryId),
    /** Edit, delete, approve or reject this link. Links restricted to some people are the super admin's. */
    canManage: (link: Link) => superAdmin || (manages(link.category_id) && link.visibility === 'everyone'),
  }
}
