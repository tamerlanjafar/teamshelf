import { MoreHorizontal, Send, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useRemoveMember, useResendInvite, useSetMemberRole } from '@/api/members'
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/app/avatar'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Segmented } from '@/components/app/form'
import { useMe, useOrg } from '@/features/org/org-context'
import { toastError } from '@/lib/errors'
import { displayName, ROLE_LABELS } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import type { Member } from '@/lib/types'
import { MemberSpaces } from './member-spaces'
import { INVITE_ROLES, type InviteRole } from './roles'

/** A person on the team, with their role. The super admin and your own row can't be changed here. */
export function MemberRow({ member }: { member: Member }) {
  const me = useMe()
  const setRole = useSetMemberRole()
  const locked = member.role === 'super_admin' || member.id === me.id

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <Avatar member={member} />
      <div className="min-w-0 flex-1 basis-[160px]">
        <div className="truncate font-medium">
          {displayName(member)}
          {member.id === me.id && <span className="text-quiet font-normal"> (you)</span>}
        </div>
        <div className="text-quiet truncate text-[12.5px]">
          {member.email}
          {!member.user_id && ` · invited ${timeAgo(member.invited_at)}`}
        </div>
        {member.role === 'super_admin' ? <div className="text-quiet mt-1 text-[12.5px]">Admin of every space</div> : <MemberSpaces member={member} />}
      </div>
      {locked ? (
        <span className="text-quiet px-1 text-[13px]">{ROLE_LABELS[member.role]}</span>
      ) : (
        <>
          <Segmented
            label={`Role of ${displayName(member)}`}
            options={INVITE_ROLES}
            value={member.role as InviteRole}
            onChange={(role) => role !== member.role && setRole.mutate({ id: member.id, role }, { onError: toastError })}
          />
          <MemberMenu member={member} />
        </>
      )}
    </div>
  )
}

function MemberMenu({ member }: { member: Member }) {
  const org = useOrg()
  const confirm = useConfirm()
  const removeMember = useRemoveMember()
  const resendInvite = useResendInvite()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`More for ${displayName(member)}`} className="text-quiet hover:text-ink hover:bg-accent data-[popup-open]:bg-accent grid size-8 flex-none place-items-center rounded-lg">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl">
        {!member.user_id && (
          <DropdownMenuItem onClick={() => resendInvite.mutate(member.email, { onSuccess: () => toast.success(`Invitation sent again to ${member.email}.`), onError: toastError })}>
            <Send />
            Resend invite
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            confirm({
              title: `Remove ${displayName(member)}?`,
              description: `${member.email} can no longer open ${org.name}, and can only come back if invited again. Links they suggested stay.`,
              confirmLabel: 'Remove',
              onConfirm: () => removeMember.mutate(member.id, { onError: toastError }),
            })
          }
        >
          <UserMinus />
          Remove…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
