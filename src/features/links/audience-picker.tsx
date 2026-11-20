import { Checkbox } from '@/components/ui/checkbox'
import { Avatar } from '@/components/app/avatar'
import { Segmented } from '@/components/app/form'
import { displayName, isSuperAdmin } from '@/lib/roles'
import type { Member, Visibility } from '@/lib/types'

const OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'admins', label: 'Space admins' },
  { value: 'members', label: 'Chosen people' },
]

/** Who may see a link: everyone who sees its space, the space's admins, or the people ticked in the list. */
export function AudiencePicker({
  visibility,
  memberIds,
  members,
  error,
  onChange,
}: {
  visibility: Visibility
  memberIds: string[]
  members: Member[]
  error?: string
  onChange: (visibility: Visibility, memberIds: string[]) => void
}) {
  // The super admin sees every link, so there is nothing to choose for them.
  const choosable = members.filter((member) => !isSuperAdmin(member))

  const toggle = (id: string, checked: boolean) => onChange(visibility, checked ? [...memberIds, id] : memberIds.filter((other) => other !== id))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">Who can see it</span>
      <Segmented label="Who can see it" options={OPTIONS} value={visibility} onChange={(next) => onChange(next, memberIds)} className="flex" />
      {visibility === 'members' && (
        <div className="bg-well mt-1 max-h-44 overflow-y-auto rounded-[11px] p-1 shadow-[inset_0_0_0_1px_var(--line)]">
          {choosable.length === 0 && <p className="text-quiet m-0 px-2.5 py-2">Nobody else can see this space yet.</p>}
          {choosable.map((member) => (
            <label key={member.id} className="hover:bg-accent flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5">
              <Checkbox checked={memberIds.includes(member.id)} onCheckedChange={(checked) => toggle(member.id, checked === true)} />
              <Avatar member={member} className="size-6 text-[10px]" />
              <span className="min-w-0 flex-1 truncate">{displayName(member)}</span>
              <span className="text-quiet truncate text-[12.5px] max-sm:hidden">{member.email}</span>
            </label>
          ))}
        </div>
      )}
      {error ? (
        <span className="text-danger text-[12.5px]">{error}</span>
      ) : (
        visibility !== 'everyone' && <span className="text-quiet text-[12.5px]">The space's admins always see it too. For everyone else it isn't on the board at all.</span>
      )}
    </div>
  )
}
