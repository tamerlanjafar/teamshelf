import { neon } from '@/lib/neon'
import type { Visibility } from '@/lib/types'
import { unwrap } from './db'

/** Who may see a link or a group. `memberIds` and `teamIds` only matter when the visibility is "members". */
export interface Audience {
  visibility: Visibility
  memberIds: string[]
  teamIds: string[]
}

export const EVERYONE: Audience = { visibility: 'everyone', memberIds: [], teamIds: [] }

/** The chosen people and teams of a link or a group, and the tables they are kept in. */
const TABLES = {
  link: { people: 'link_access', teams: 'link_team_access', key: 'link_id' },
  group: { people: 'group_access', teams: 'group_team_access', key: 'group_id' },
} as const

export type AccessOf = keyof typeof TABLES

export async function readAccess(kind: AccessOf, id: string): Promise<{ memberIds: string[]; teamIds: string[] }> {
  const { people, teams, key } = TABLES[kind]
  const [memberRows, teamRows] = await Promise.all([
    unwrap<{ member_id: string }[]>(neon.from(people).select('member_id').eq(key, id)),
    unwrap<{ team_id: string }[]>(neon.from(teams).select('team_id').eq(key, id)),
  ])
  return { memberIds: memberRows.map((row) => row.member_id), teamIds: teamRows.map((row) => row.team_id) }
}

/** Replaces who was chosen. Any other visibility keeps no one chosen. */
export async function setAccess(kind: AccessOf, id: string, { visibility, memberIds, teamIds }: Audience) {
  const { people, teams, key } = TABLES[kind]
  await Promise.all([unwrap(neon.from(people).delete().eq(key, id)), unwrap(neon.from(teams).delete().eq(key, id))])
  if (visibility !== 'members') return
  if (memberIds.length > 0) await unwrap(neon.from(people).insert(memberIds.map((member_id) => ({ [key]: id, member_id }))))
  if (teamIds.length > 0) await unwrap(neon.from(teams).insert(teamIds.map((team_id) => ({ [key]: id, team_id }))))
}
