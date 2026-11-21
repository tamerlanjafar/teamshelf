import type { Role } from '@/lib/types'

/** The roles an admin of the organization can give. */
export type InviteRole = Role

export const INVITE_ROLES: { value: InviteRole; label: string; detail: string }[] = [
  { value: 'member', label: 'Member', detail: 'Sees the spaces open to everyone, suggests links and can start private spaces.' },
  { value: 'admin', label: 'Org Admin', detail: "Also invites and removes people, and changes the organization's settings." },
]
