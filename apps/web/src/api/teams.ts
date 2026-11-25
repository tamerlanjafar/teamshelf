import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import type { SpaceTeam, Team, TeamMember } from '@/lib/types'
import { isUniqueViolation, unwrap } from './db'

export interface Teams {
  teams: Team[]
  /** Who is in which team. */
  members: TeamMember[]
  /** Which private spaces took in which teams (of the spaces this person can see). */
  spaces: SpaceTeam[]
}

const NO_TEAMS: Teams = { teams: [], members: [], spaces: [] }

const teamsKey = (orgId: string) => [orgId, 'teams'] as const

/** The organization's teams, who is in them, and the spaces they were given. Everyone in the organization sees them. */
export const teamsQuery = (orgId: string) =>
  queryOptions({
    queryKey: teamsKey(orgId),
    queryFn: async (): Promise<Teams> => {
      const [teams, members, spaces] = await Promise.all([
        unwrap<Team[]>(neon.from('teams').select('*').eq('org_id', orgId)),
        unwrap<TeamMember[]>(neon.from('team_members').select('team_id, member_id, org_id').eq('org_id', orgId)),
        unwrap<SpaceTeam[]>(neon.from('space_teams').select('space_id, team_id, org_id').eq('org_id', orgId)),
      ])
      teams.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
      return { teams, members, spaces }
    },
  })

/** Suspends until the teams are loaded: use it inside a <Section>. */
export const useTeams = () => useSuspenseQuery(teamsQuery(useOrg().id)).data

/** The teams, or none while they load. */
export const useTeamsIfLoaded = (): Teams => useQuery(teamsQuery(useOrg().id)).data ?? NO_TEAMS

/** The ids of the people in a team. */
export const peopleOf = (data: Teams, teamId: string) => data.members.filter((row) => row.team_id === teamId).map((row) => row.member_id)

/** The ids of the people who are in a space through the teams it took in. */
export function peopleThroughTeams(data: Teams, spaceId: string) {
  const teams = new Set(data.spaces.filter((row) => row.space_id === spaceId).map((row) => row.team_id))
  return new Set(data.members.filter((row) => teams.has(row.team_id)).map((row) => row.member_id))
}

/** Who sees what depends on the teams, so everything of the organization is loaded again after a change. */
function useRefresh() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === org.id })
}

const named = (name: string) => (error: unknown) => (isUniqueViolation(error) ? new Error(`There is already a team called ${name.trim()}.`) : error)

/** Creates a team with the people chosen. Admins of the organization. */
export function useCreateTeam() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      let team: Team
      try {
        team = await unwrap<Team>(neon.from('teams').insert({ org_id: org.id, name: name.trim() }).select().single())
      } catch (error) {
        throw named(name)(error)
      }
      if (memberIds.length > 0) await unwrap(neon.from('team_members').insert(memberIds.map((member_id) => ({ team_id: team.id, member_id, org_id: org.id }))))
      return team
    },
    onSettled: refresh,
  })
}

/** Renames a team and sets who is in it: those added join, those left out leave. Admins of the organization. */
export function useUpdateTeam() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ team, name, memberIds, current }: { team: Team; name: string; memberIds: string[]; current: string[] }) => {
      if (name.trim() !== team.name) {
        try {
          await unwrap(neon.from('teams').update({ name: name.trim() }).eq('id', team.id))
        } catch (error) {
          throw named(name)(error)
        }
      }
      const joining = memberIds.filter((id) => !current.includes(id))
      const leaving = current.filter((id) => !memberIds.includes(id))
      if (joining.length > 0) await unwrap(neon.from('team_members').insert(joining.map((member_id) => ({ team_id: team.id, member_id, org_id: org.id }))))
      for (const member_id of leaving) await unwrap(neon.from('team_members').delete().eq('team_id', team.id).eq('member_id', member_id))
    },
    onSettled: refresh,
  })
}

/** Deletes a team. What it was given stops being seen through it. Admins of the organization. */
export function useDeleteTeam() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (id: string) => unwrap(neon.from('teams').delete().eq('id', id)), onSettled: refresh })
}

/** Gives a private space to a team, or (add false) takes it back. The space's admins. */
export function useSetSpaceTeam() {
  const org = useOrg()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ spaceId, teamId, add }: { spaceId: string; teamId: string; add: boolean }) => {
      const rows = neon.from('space_teams')
      if (add) await unwrap(rows.insert({ space_id: spaceId, team_id: teamId, org_id: org.id }))
      else await unwrap(rows.delete().eq('space_id', spaceId).eq('team_id', teamId))
    },
    onSettled: refresh,
  })
}
