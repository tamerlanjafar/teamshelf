import { useSpaceMembersIfLoaded, useSpacesIfLoaded } from '@/api/spaces'
import { SpaceLogo } from '@/features/spaces/space-logo'
import type { Member } from '@/lib/types'

/** The spaces a person runs, under their name on the Team page. Who is in a space is changed in its settings. */
export function MemberSpaces({ member }: { member: Member }) {
  const spaces = useSpacesIfLoaded()
  const rows = useSpaceMembersIfLoaded()
  const runs = spaces.filter((space) => rows.some((row) => row.space_id === space.id && row.member_id === member.id && row.role === 'admin'))
  if (runs.length === 0) return null

  return (
    <div className="text-quiet mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
      Admin of
      {runs.map((space) => (
        <span key={space.id} className="text-ink inline-flex items-center gap-1">
          <SpaceLogo space={space} className="size-4 rounded-[5px]" />
          {space.name}
        </span>
      ))}
    </div>
  )
}
