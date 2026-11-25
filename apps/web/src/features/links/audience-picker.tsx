import { Users } from 'lucide-react'
import type { Audience } from '@/api/access'
import { useSpaceMembersIfLoaded } from '@/api/spaces'
import { peopleOf, useTeamsIfLoaded } from '@/api/teams'
import { Avatar } from '@/components/app/avatar'
import { Segmented } from '@/components/app/form'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { useMe } from '@/features/org/org-context'
import { displayName } from '@/lib/roles'
import type { Member, Space, Visibility } from '@/lib/types'

const OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'admins', label: 'Space admins' },
  { value: 'members', label: 'People & teams' },
]

/** One choice in the list: a team, or a person. */
interface Pick {
  kind: 'team' | 'person'
  id: string
  name: string
  /** For a team, how many people; for a person, their email. */
  detail: string
  member?: Member
}

const same = (a: Pick, b: Pick) => a.kind === b.kind && a.id === b.id

/**
 * Who may see a link or a group: everyone who sees its space, the space's admins, or the teams
 * and people chosen. Chosen ones are chips in one field; typing finds teams and people to add.
 * The space's admins always see it, so they aren't offered.
 */
export function AudiencePicker({
  space,
  noun,
  audience,
  members,
  error,
  onChange,
}: {
  space: Space
  /** What is being shown: "link" or "group". */
  noun: 'link' | 'group'
  audience: Audience
  /** The people it can be shown to. */
  members: Member[]
  error?: string
  onChange: (audience: Audience) => void
}) {
  const me = useMe()
  const data = useTeamsIfLoaded()
  const anchor = useComboboxAnchor()
  const admins = new Set(useSpaceMembersIfLoaded().filter((row) => row.space_id === space.id && row.role === 'admin').map((row) => row.member_id))
  const { visibility, memberIds, teamIds } = audience

  const teams: Pick[] = data.teams.map((team) => {
    const count = peopleOf(data, team.id).length
    return { kind: 'team', id: team.id, name: team.name, detail: count === 0 ? 'nobody yet' : `${count} ${count === 1 ? 'person' : 'people'}` }
  })
  const people: Pick[] = members
    .filter((member) => !admins.has(member.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
    .map((member) => ({ kind: 'person', id: member.id, name: displayName(member) + (member.id === me.id ? ' (you)' : ''), detail: member.email, member }))
  const groups = [
    { value: 'Teams', items: teams },
    { value: 'People', items: people },
  ].filter((group) => group.items.length > 0)
  const chosen = [...teams.filter((one) => teamIds.includes(one.id)), ...people.filter((one) => memberIds.includes(one.id))]

  const choose = (picks: Pick[]) =>
    onChange({ ...audience, teamIds: picks.filter((one) => one.kind === 'team').map((one) => one.id), memberIds: picks.filter((one) => one.kind === 'person').map((one) => one.id) })

  const who = {
    everyone: `Everyone in ${space.name} sees this ${noun}.`,
    admins: `Only admins of ${space.name} see this ${noun}.`,
    members: `Only those you add, and admins of ${space.name}, see this ${noun}.`,
  }[visibility]

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">Who can see it</span>
      <Segmented label="Who can see it" options={OPTIONS} value={visibility} onChange={(next) => onChange({ ...audience, visibility: next })} className="flex" />

      {visibility === 'members' && (
        <Combobox
          multiple
          autoHighlight
          items={groups}
          value={chosen}
          onValueChange={(next) => choose(next as Pick[])}
          isItemEqualToValue={same}
          itemToStringLabel={(item: Pick) => `${item.name} ${item.detail}`}
          itemToStringValue={(item: Pick) => `${item.kind}:${item.id}`}
        >
          <ComboboxChips ref={anchor} className="bg-well mt-1 min-h-10 gap-1.5 rounded-md border-0 px-1.5 py-1.5 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--brand)] focus-within:ring-0 has-aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)] has-aria-invalid:ring-0">
            {chosen.map((pick) => (
              <ComboboxChip key={`${pick.kind}:${pick.id}`} aria-label={pick.name} className="bg-raised h-7 gap-1.5 rounded-full pr-0.5 pl-1 text-[13px] shadow-[0_0_0_1px_var(--line)]">
                <Mark pick={pick} small />
                {pick.name}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              aria-label="Add teams or people"
              aria-invalid={Boolean(error)}
              placeholder={chosen.length === 0 ? 'Add a team or person…' : 'Add more…'}
              className="placeholder:text-quiet/80 h-7 px-1.5 text-[13.5px]"
            />
          </ComboboxChips>
          <ComboboxContent anchor={anchor} className="rounded-lg">
            <ComboboxEmpty>{groups.length === 0 ? `Nobody else is in ${space.name} yet.` : 'No team or person matches.'}</ComboboxEmpty>
            <ComboboxList>
              {(group: { value: string; items: Pick[] }) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>
                    {(pick: Pick) => (
                      <ComboboxItem key={`${pick.kind}:${pick.id}`} value={pick} className="gap-2.5 py-1.5">
                        <Mark pick={pick} />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{pick.name}</span>
                          <span className="text-quiet"> · {pick.detail}</span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
      {error ? <span className="text-danger text-[12.5px]">{error}</span> : <span className="text-quiet text-[12.5px]">{who}</span>}
    </div>
  )
}

/** A team's icon, or a person's avatar. */
function Mark({ pick, small = false }: { pick: Pick; small?: boolean }) {
  if (pick.member) return <Avatar member={pick.member} className={small ? 'size-5 text-[9px]' : 'size-6 text-[10px]'} />
  return (
    <span className={`bg-well text-quiet grid flex-none place-items-center rounded-full ${small ? 'size-5' : 'size-6'}`}>
      <Users className={small ? 'size-3' : 'size-3.5'} />
    </span>
  )
}
