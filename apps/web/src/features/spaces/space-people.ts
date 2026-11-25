import { useMembersIfLoaded } from '@/api/members'
import { useSpaceMembersIfLoaded } from '@/api/spaces'
import { peopleThroughTeams, useTeamsIfLoaded } from '@/api/teams'
import type { Member, Space } from '@/lib/types'

/**
 * The people who see a space, to show a link or a group to: everyone in the organization for an
 * open space; for a private one, its people and the people of the teams it took in.
 */
export function useSpacePeople(space: Space | null | undefined): Member[] {
  const members = useMembersIfLoaded()
  const rows = useSpaceMembersIfLoaded()
  const teams = useTeamsIfLoaded()
  if (!space) return []
  if (space.visibility !== 'private') return members
  const viaTeams = peopleThroughTeams(teams, space.id)
  return members.filter((member) => viaTeams.has(member.id) || rows.some((row) => row.space_id === space.id && row.member_id === member.id))
}
