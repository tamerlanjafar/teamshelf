import type { Member, Role, Team } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Org Admin',
  member: 'Member',
}

/** Roles are per organization: these ask about the organization the member row belongs to. */
export const isAdmin = (member: Member) => member.role === 'admin'

/** Creates teams (and opens the Team page): admins of the organization, and the people they let. */
export const managesTeams = (member: Member) => isAdmin(member) || Boolean(member.manages_teams)

/** Changes a team: an admin of the organization, or whoever created it while they manage teams. */
export const canEditTeam = (member: Member, team: Team) => isAdmin(member) || (Boolean(member.manages_teams) && team.created_by === member.id)

/** "Aysel Mammadova", or the part of the email before the @ for someone who has no name yet. */
export const displayName = (member: Pick<Member, 'name' | 'email'>) => member.name.trim() || member.email.split('@')[0]

export function initials(member: Pick<Member, 'name' | 'email'>) {
  const words = displayName(member).split(/[\s._-]+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}
