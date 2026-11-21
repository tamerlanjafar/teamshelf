import type { Member, Role } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Org Admin',
  member: 'Member',
}

/** Roles are per organization: these ask about the organization the member row belongs to. */
export const isAdmin = (member: Member) => member.role === 'admin'

/** "Aysel Mammadova", or the part of the email before the @ for someone who has no name yet. */
export const displayName = (member: Pick<Member, 'name' | 'email'>) => member.name.trim() || member.email.split('@')[0]

export function initials(member: Pick<Member, 'name' | 'email'>) {
  const words = displayName(member).split(/[\s._-]+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}
