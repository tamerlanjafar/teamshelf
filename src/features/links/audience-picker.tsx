import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import { useSpaceMembersIfLoaded } from '@/api/spaces'
import { Avatar } from '@/components/app/avatar'
import { Segmented } from '@/components/app/form'
import { useMe } from '@/features/org/org-context'
import { displayName } from '@/lib/roles'
import type { Member, Space, Visibility } from '@/lib/types'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'admins', label: 'Space admins' },
  { value: 'members', label: 'Chosen people' },
]

/** With more people than this, the list gets a search. */
const SEARCH_FROM = 6

/**
 * Who may see a link: everyone who sees its space, the space's admins, or people picked from a
 * list. A line under the choice says who that is. In the list the space's admins are already
 * ticked and can't be unticked, since they always see it.
 */
export function AudiencePicker({
  space,
  visibility,
  memberIds,
  members,
  error,
  onChange,
}: {
  space: Space
  visibility: Visibility
  memberIds: string[]
  members: Member[]
  error?: string
  onChange: (visibility: Visibility, memberIds: string[]) => void
}) {
  const me = useMe()
  const admins = new Set(useSpaceMembersIfLoaded().filter((row) => row.space_id === space.id && row.role === 'admin').map((row) => row.member_id))
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase()
  const listed = members
    .filter((member) => !words || `${displayName(member)} ${member.email}`.toLowerCase().includes(words))
    .sort((a, b) => Number(admins.has(b.id)) - Number(admins.has(a.id)) || displayName(a).localeCompare(displayName(b)))
  const chosen = memberIds.filter((id) => !admins.has(id) && members.some((member) => member.id === id)).length

  const toggle = (id: string) => onChange(visibility, memberIds.includes(id) ? memberIds.filter((other) => other !== id) : [...memberIds, id])

  const who = {
    everyone: `Everyone in ${space.name} sees this link.`,
    admins: `Only admins of ${space.name} see this link.`,
    members: `Only the people you pick and admins of ${space.name} see this link.`,
  }[visibility]

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">Who can see it</span>
      <Segmented label="Who can see it" options={OPTIONS} value={visibility} onChange={(next) => onChange(next, memberIds)} className="flex" />
      <span className="text-quiet text-[12.5px]">{who}</span>

      {visibility === 'members' && (
        <div className="border-line mt-1 overflow-hidden rounded-md border">
          {members.length > SEARCH_FROM && (
            <div className="border-line flex h-9 items-center gap-2 border-b px-3">
              <Search className="text-quiet size-4 flex-none" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                aria-label="Search people"
                autoComplete="off"
                className="placeholder:text-quiet/80 h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
              />
            </div>
          )}
          <ul className="divide-line m-0 max-h-56 list-none divide-y overflow-y-auto p-0">
            {listed.map((member) => {
              const admin = admins.has(member.id)
              const ticked = admin || memberIds.includes(member.id)
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={ticked}
                    disabled={admin}
                    onClick={() => toggle(member.id)}
                    className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:cursor-default', ticked && !admin ? 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]' : 'enabled:hover:bg-ink/4')}
                  >
                    <Avatar member={member} className="size-7 text-[10.5px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {displayName(member)}
                        {member.id === me.id && <span className="text-quiet font-normal"> (you)</span>}
                      </span>
                      <span className="text-quiet block truncate text-[12px]">{admin ? 'Admin, always sees it' : member.email}</span>
                    </span>
                    <span className={cn('grid size-5 flex-none place-items-center rounded-full border transition-colors', ticked ? 'bg-brand border-brand text-on-brand' : 'border-line', admin && 'opacity-45')}>
                      {ticked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              )
            })}
            {listed.length === 0 && <li className="text-quiet px-3 py-5 text-center text-[13px]">{members.length === 0 ? `Nobody else is in ${space.name} yet.` : 'No one matches.'}</li>}
          </ul>
          <div className="border-line bg-well/60 text-quiet border-t px-3 py-1.5 text-[12px]">{chosen === 0 ? 'No one picked yet' : `${chosen} picked`}</div>
        </div>
      )}
      {error && <span className="text-danger text-[12.5px]">{error}</span>}
    </div>
  )
}
