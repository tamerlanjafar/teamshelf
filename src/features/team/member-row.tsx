import { Check, Layers, MoreHorizontal, Send, Shield, ShieldOff, UserMinus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useApproveMember, useMembersIfLoaded, useRemoveMember, useResendInvite, useSetMemberRole } from '@/api/members'
import { useSpaceMembersIfLoaded, useSpacesIfLoaded } from '@/api/spaces'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/app/avatar'
import { useConfirm } from '@/components/app/confirm-dialog'
import { useMe, useOrg } from '@/features/org/org-context'
import { toastError } from '@/lib/errors'
import { displayName, ROLE_LABELS } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import type { Member, SpaceRole } from '@/lib/types'
import { SpaceBadge } from '@/features/spaces/space-badge'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * A person on the team, in one calm line: who they are, the spaces they run (as small logos), an
 * Org Admin badge, and a menu for the rest. Your own row has no menu.
 */
export function MemberRow({ member }: { member: Member }) {
  const me = useMe()
  const invited = !member.user_id

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar member={member} className="size-9 text-[12.5px]" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{displayName(member)}</span>
          {member.id === me.id && <span className="text-quiet flex-none text-[13px]">(you)</span>}
          {invited && <span className="bg-well text-quiet flex-none rounded-xs px-1.5 text-[11.5px] leading-5 font-medium">Invited {timeAgo(member.invited_at)}</span>}
        </div>
        <div className="text-quiet truncate text-[13px]">{member.email}</div>
      </div>
      {/* Fixed slots, so the counts and badges line up from row to row. */}
      <span className="flex w-24 flex-none justify-end max-sm:hidden">
        <SpacesRun member={member} />
      </span>
      <span className="flex w-[84px] flex-none justify-end">
        {member.role === 'admin' && (
          <span className="text-brand rounded-sm bg-[color-mix(in_srgb,var(--brand)_11%,transparent)] px-2 text-[12px] leading-6 font-semibold whitespace-nowrap">{ROLE_LABELS.admin}</span>
        )}
      </span>
      {member.id === me.id ? <span className="w-8 flex-none" aria-hidden="true" /> : <MemberMenu member={member} />}
    </div>
  )
}

/**
 * How many spaces someone is in, as a quiet button. It opens the list: each space with its logo
 * and their role in it. Stays one small thing however many spaces there are.
 */
function SpacesRun({ member }: { member: Member }) {
  const spaces = useSpacesIfLoaded()
  const rows = useSpaceMembersIfLoaded()
  const [open, setOpen] = useState(false)
  const theirs = spaces
    .map((space) => ({ space, role: rows.find((row) => row.space_id === space.id && row.member_id === member.id)?.role }))
    .filter((entry): entry is { space: (typeof spaces)[number]; role: SpaceRole } => Boolean(entry.role))
    .sort((a, b) => (a.role === b.role ? a.space.name.localeCompare(b.space.name) : a.role === 'admin' ? -1 : 1))
  if (theirs.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-quiet hover:text-ink hover:bg-ink/5 flex flex-none items-center gap-1.5 rounded-sm px-2 text-[12.5px] leading-6 font-medium whitespace-nowrap transition-colors"
      >
        <Layers className="size-3.5" />
        {theirs.length} {theirs.length === 1 ? 'space' : 'spaces'}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-[650] [font-family:var(--font-rounded)]">{displayName(member)}'s spaces</DialogTitle>
          </DialogHeader>
          <ul className="border-line divide-line m-0 list-none divide-y overflow-hidden rounded-md border p-0">
            {theirs.map(({ space, role }) => (
              <li key={space.id} className="flex items-center gap-2.5 px-3 py-2.5">
                <SpaceLogo space={space} className="size-6 rounded-xs" />
                <span className="min-w-0 flex-1 truncate">{space.name}</span>
                <span className={role === 'admin' ? 'text-brand text-[12.5px] font-semibold' : 'text-quiet text-[12.5px]'}>{role === 'admin' ? 'Admin' : 'Member'}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MemberMenu({ member }: { member: Member }) {
  const org = useOrg()
  const confirm = useConfirm()
  const removeMember = useRemoveMember()
  const resendInvite = useResendInvite()
  const setRole = useSetMemberRole()
  const admin = member.role === 'admin'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`More for ${displayName(member)}`} className="text-quiet hover:text-ink hover:bg-accent data-[popup-open]:bg-accent grid size-8 flex-none place-items-center rounded-md">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
        <DropdownMenuItem onClick={() => setRole.mutate({ id: member.id, role: admin ? 'member' : 'admin' }, { onError: toastError })}>
          {admin ? <ShieldOff /> : <Shield />}
          {admin ? 'Make member' : `Make ${ROLE_LABELS.admin}`}
        </DropdownMenuItem>
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

/**
 * Someone a space invited from outside what the organization lets in: who invited them to which
 * space, and approving (they get the sign-in link) or turning it down. Admins of the organization.
 */
export function WaitingRow({ member }: { member: Member }) {
  const spaces = useSpacesIfLoaded()
  const rows = useSpaceMembersIfLoaded()
  const members = useMembersIfLoaded()
  const approve = useApproveMember()
  const remove = useRemoveMember()
  const confirm = useConfirm()
  const invitedTo = spaces.filter((space) => rows.some((row) => row.space_id === space.id && row.member_id === member.id))
  const inviter = members.find((other) => other.id === member.invited_by)

  return (
    <div className="bg-raised border-line flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-4">
      <Avatar member={member} className="size-9 text-[12.5px]" />
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="truncate font-medium">{member.email}</div>
        <div className="text-quiet mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
          Invited to
          {invitedTo.length > 0 ? invitedTo.map((space) => <SpaceBadge key={space.id} space={space} />) : <SpaceBadge space={undefined} />}
          {inviter && <span>by {displayName(inviter)}</span>}
          <span aria-hidden="true">·</span>
          <span>{timeAgo(member.invited_at)}</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={remove.isPending || approve.isPending}
        onClick={() =>
          confirm({
            title: `Turn down ${member.email}?`,
            description: 'They won\'t be invited. Whoever invited them can ask you again.',
            confirmLabel: 'Turn down',
            onConfirm: () => remove.mutate(member.id, { onError: toastError }),
          })
        }
      >
        <X />
        Turn down
      </Button>
      <Button size="sm" disabled={approve.isPending || remove.isPending} onClick={() => approve.mutate(member, { onSuccess: () => toast.success(`${member.email} is invited.`), onError: toastError })}>
        <Check />
        Approve
      </Button>
    </div>
  )
}
