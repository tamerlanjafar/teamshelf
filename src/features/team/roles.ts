import type { Role } from '@/lib/types'

/** The roles an admin can give. There is one super admin, set in the database. */
export type InviteRole = Exclude<Role, 'super_admin'>

export const INVITE_ROLES: { value: InviteRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
]
