import { Navigate } from '@tanstack/react-router'
import { Check, FolderPlus, Globe, Lock, Mail, MoreHorizontal, Pencil, Plus, Search, Shield, ShieldOff, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { groupsOf, useDeleteGroup, useGroups } from '@/api/groups'
import { useBoardLinks } from '@/api/links'
import { useMembers } from '@/api/members'
import { useDeleteSpace, useInviteToSpace, useSetSpaceMember, useSpaceMembersIfLoaded, useUpdateSpace } from '@/api/spaces'
import { Avatar } from '@/components/app/avatar'
import { ColorPicker } from '@/components/app/color-picker'
import { useConfirm } from '@/components/app/confirm-dialog'
import { TextInput } from '@/components/app/form'
import { PageSheet } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GroupDialog } from '@/features/board/group-dialog'
import { useMe, useOrg } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { colorValue } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import { isEmail } from '@/lib/neon'
import { displayName } from '@/lib/roles'
import type { Color, Group, Member, Space, SpaceRole, SpaceVisibility } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useCurrentSpace, useOpenSpace } from './current-space'
import { LogoPicker, UploadLogoButton } from './logo-picker'
import { NewGroupDialog } from './new-group-dialog'
import { isImageLogo, SpaceLogo } from './space-logo'

/**
 * Everything about one space, for its admins: its name and logo, who sees it, its people, its
 * groups, and deleting it.
 */
export function SpaceSettingsPage() {
  return (
    <>
      <TopBar />
      <Section compact skeleton={<ListSkeleton rows={6} />}>
        <SpaceSettings />
      </Section>
    </>
  )
}

function SpaceSettings() {
  const org = useOrg()
  const space = useCurrentSpace()
  const { isSpaceAdmin } = usePermissions()
  if (!space) return <Navigate to="/$org" params={{ org: org.slug }} replace />
  if (!isSpaceAdmin(space.id)) return <Navigate to="/$org/$space" params={{ org: org.slug, space: space.slug }} replace />

  return (
    <PageSheet title={`${space.name} settings`}>
      {/* Keyed by space, so each form starts from the space it shows. */}
      <Identity key={`identity-${space.id}`} space={space} />
      <Visibility space={space} />
      <People space={space} />
      <Groups space={space} />
      <DangerZone space={space} />
    </PageSheet>
  )
}

/** A part of the page: a small heading (with a count and an action at its right), then one rounded box. */
function Panel({ title, count, action, padded = true, children }: { title: string; count?: number; action?: ReactNode; padded?: boolean; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2.5">
      <div className="mx-1 flex min-h-8 flex-wrap items-center gap-2">
        <h2 className="text-quiet m-0 flex flex-1 items-center gap-2 text-[13px] font-semibold">
          {title}
          {count !== undefined && <span className="bg-ink/8 rounded-full px-2 py-0.5 text-[11.5px] tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      <div className={cn('bg-raised border-line min-w-0 overflow-hidden rounded-xl border', padded ? 'p-4' : 'divide-line divide-y')}>{children}</div>
    </section>
  )
}

/** A row's "⋯" menu. */
function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className="text-quiet hover:text-ink hover:bg-accent data-[popup-open]:bg-accent grid size-8 flex-none place-items-center rounded-md">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The space's logo (a button that opens its logo and color), its name, and saving the name. */
function Identity({ space }: { space: Space }) {
  const [name, setName] = useState(space.name)
  const [picking, setPicking] = useState(false)
  const updateSpace = useUpdateSpace()
  const changed = name.trim() !== space.name

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !changed) return
    updateSpace.mutate({ id: space.id, changes: { name: name.trim() } }, { onSuccess: () => toast.success('Saved.'), onError: toastError })
  }

  return (
    <Panel title="Space">
      <form onSubmit={submit} className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setPicking(true)} aria-label="Change the logo and color" title="Change the logo and color" className="flex-none rounded-md transition-opacity hover:opacity-85">
          <SpaceLogo space={space} className="size-10 rounded-md" />
        </button>
        <TextInput value={name} maxLength={40} aria-label="Name" onChange={(event) => setName(event.target.value)} className="h-10 min-w-0 flex-1" />
        <Button type="submit" disabled={!changed || !name.trim() || updateSpace.isPending}>
          Save
        </Button>
      </form>
      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="rounded-xl sm:max-w-[480px]">{picking && <LogoAndColor space={space} onDone={() => setPicking(false)} />}</DialogContent>
      </Dialog>
    </Panel>
  )
}

/**
 * The space's look: a large preview with its name, uploading an image (or going back to an icon),
 * then the icons and the colors. Colors only tint icons, so with an image they are dimmed.
 */
function LogoAndColor({ space, onDone }: { space: Space; onDone: () => void }) {
  const [logo, setLogo] = useState(space.logo)
  const [color, setColor] = useState<Color>(space.color)
  const updateSpace = useUpdateSpace()
  const image = isImageLogo(logo)
  const changed = logo !== space.logo || color !== space.color

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[18px] font-[650] [font-family:var(--font-rounded)]">Logo and color</DialogTitle>
      </DialogHeader>

      <div className="bg-well flex flex-wrap items-center gap-4 rounded-lg p-4">
        <SpaceLogo space={{ name: space.name, logo, color }} className="size-14 rounded-lg shadow-[0_2px_8px_hsl(var(--shadow)/0.12)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-[650] [font-family:var(--font-rounded)]">{space.name}</div>
          <div className="text-quiet text-[12.5px]">{image ? 'Using your uploaded image' : 'Pick an icon and a color, or upload an image'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {image && (
            <Button type="button" variant="ghost" onClick={() => setLogo(space.logo !== logo && !isImageLogo(space.logo) ? space.logo : 'grid')}>
              Use an icon
            </Button>
          )}
          <UploadLogoButton onChange={setLogo} />
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Icon</span>
        <LogoPicker space={{ name: space.name, logo, color }} onChange={setLogo} />
      </div>

      <div className={cn('grid gap-2 transition-opacity', image && 'opacity-45')}>
        <span className="text-[13px] font-medium">
          Color{image && <span className="text-quiet font-normal"> · tints icons, not images</span>}
        </span>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!changed || updateSpace.isPending} onClick={() => updateSpace.mutate({ id: space.id, changes: { logo, color } }, { onSuccess: onDone, onError: toastError })}>
          Save
        </Button>
      </DialogFooter>
    </div>
  )
}

/** One of several choices as a card: icon, label, and a line on what it means. */
function Choice({ chosen, disabled, icon, label, detail, onClick }: { chosen: boolean; disabled?: boolean; icon: ReactNode; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-4',
        chosen ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]' : 'border-line enabled:hover:border-[color-mix(in_srgb,var(--ink)_20%,transparent)]',
      )}
    >
      <span className={cn('mt-0.5 flex-none', chosen ? 'text-brand' : 'text-quiet')}>{icon}</span>
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-quiet block text-[12.5px] leading-snug">{detail}</span>
      </span>
    </button>
  )
}

/** Who sees the space. Opening it to everyone is for admins of the organization (the database checks it too). */
function Visibility({ space }: { space: Space }) {
  const org = useOrg()
  const { admin } = usePermissions()
  const updateSpace = useUpdateSpace()
  const confirm = useConfirm()
  const locked = !admin && space.visibility !== 'org'

  function change(visibility: SpaceVisibility) {
    if (visibility === space.visibility) return
    const apply = () => updateSpace.mutate({ id: space.id, changes: { visibility } }, { onError: toastError })
    if (visibility === 'org') apply()
    else
      confirm({
        title: `Make ${space.name} private?`,
        description: `Only people you add under People will see ${space.name}. Everyone else in ${org.name} won't see it anymore.${admin ? '' : ` Only an Org Admin can open it again.`}`,
        confirmLabel: 'Make private',
        onConfirm: apply,
      })
  }

  return (
    <Panel title="Who sees it">
      <div role="radiogroup" aria-label="Who sees it" className="grid gap-2 sm:grid-cols-2">
        <Choice
          chosen={space.visibility === 'org'}
          disabled={locked}
          icon={<Globe />}
          label={`Everyone in ${org.name}`}
          detail={locked ? 'Only an Org Admin can open a space to everyone.' : 'Anyone in the organization sees it and can suggest links.'}
          onClick={() => change('org')}
        />
        <Choice chosen={space.visibility === 'private'} icon={<Lock />} label="Only its people" detail="Hidden from everyone else in the organization." onClick={() => change('private')} />
      </div>
    </Panel>
  )
}

/**
 * The space's people, one calm line each like the Team page: who they are, where their invitation
 * stands, an Admin badge, and a menu for the rest. A space keeps at least one admin.
 */
function People({ space }: { space: Space }) {
  const me = useMe()
  const members = useMembers()
  const rows = useSpaceMembersIfLoaded().filter((row) => row.space_id === space.id)
  const setMember = useSetSpaceMember()
  const [adding, setAdding] = useState(false)

  const inSpace = rows
    .map((row) => ({ row, member: members.find((member) => member.id === row.member_id) }))
    .filter((entry): entry is { row: (typeof rows)[number]; member: Member } => Boolean(entry.member))
    .sort((a, b) => (a.row.role === b.row.role ? displayName(a.member).localeCompare(displayName(b.member)) : a.row.role === 'admin' ? -1 : 1))
  const admins = rows.filter((row) => row.role === 'admin').length

  const set = (member: Member, role: SpaceRole | null, current: SpaceRole | null) =>
    setMember.mutate({ spaceId: space.id, memberId: member.id, role, current }, { onError: toastError })

  return (
    <Panel
      title="People"
      count={inSpace.length}
      padded={false}
      action={
        <Button variant="outline" onClick={() => setAdding(true)}>
          <UserPlus />
          Add people
        </Button>
      }
    >
      {inSpace.length === 0 && <p className="text-quiet m-0 px-4 py-3">Nobody yet.</p>}
      {inSpace.map(({ row, member }) => {
        const lastAdmin = row.role === 'admin' && admins === 1
        return (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar member={member} className="size-9 text-[12.5px]" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{displayName(member)}</span>
                {member.id === me.id && <span className="text-quiet flex-none text-[13px]">(you)</span>}
                {!member.approved ? (
                  <span className="bg-well text-quiet flex-none rounded-xs px-1.5 text-[11.5px] leading-5 font-medium">Waiting for approval</span>
                ) : (
                  !member.user_id && <span className="bg-well text-quiet flex-none rounded-xs px-1.5 text-[11.5px] leading-5 font-medium">Invited</span>
                )}
              </div>
              <div className="text-quiet truncate text-[13px]">{member.email}</div>
            </div>
            {row.role === 'admin' && <span className="text-brand flex-none rounded-sm bg-[color-mix(in_srgb,var(--brand)_11%,transparent)] px-2 text-[12px] leading-6 font-semibold">Admin</span>}
            <RowMenu label={`More for ${displayName(member)}`}>
              <DropdownMenuItem disabled={lastAdmin} onClick={() => set(member, row.role === 'admin' ? 'member' : 'admin', row.role)}>
                {row.role === 'admin' ? <ShieldOff /> : <Shield />}
                {row.role === 'admin' ? 'Make member' : 'Make admin'}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={lastAdmin} onClick={() => set(member, null, row.role)}>
                <UserMinus />
                Remove from {space.name}
              </DropdownMenuItem>
              {lastAdmin && <p className="text-quiet m-0 px-2 py-1.5 text-[12px]">A space keeps at least one admin.</p>}
            </RowMenu>
          </div>
        )
      })}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="rounded-xl sm:max-w-[560px]">{adding && <AddPeople space={space} onDone={() => setAdding(false)} />}</DialogContent>
      </Dialog>
    </Panel>
  )
}

const ROLES: { value: SpaceRole; label: string; detail: string }[] = [
  { value: 'member', label: 'Member', detail: 'Sees the space and suggests links.' },
  { value: 'admin', label: 'Admin', detail: 'Also manages its links, people and settings.' },
]

/**
 * Adds people in two steps: pick them (people of the organization, found by name or email, or the
 * email of someone new), choose their role, then confirm with one button that says what happens.
 * Someone new joins the organization too: at once when its email's domain is let in, otherwise
 * once an admin of the organization approves.
 */
function AddPeople({ space, onDone }: { space: Space; onDone: () => void }) {
  const org = useOrg()
  const members = useMembers()
  const rows = useSpaceMembersIfLoaded().filter((row) => row.space_id === space.id)
  const setMember = useSetSpaceMember()
  const invite = useInviteToSpace()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<SpaceRole>('member')
  const [picked, setPicked] = useState<Member[]>([])
  const [emails, setEmails] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const words = query.trim().toLowerCase()
  const others = members.filter((member) => member.approved && !rows.some((row) => row.member_id === member.id))
  const found = others.filter((member) => !words || `${displayName(member)} ${member.email}`.toLowerCase().includes(words)).sort((a, b) => displayName(a).localeCompare(displayName(b)))
  // Picked people stay listed while the search hides others, still in name order.
  const shown = others.filter((member) => found.includes(member) || picked.includes(member)).sort((a, b) => displayName(a).localeCompare(displayName(b)))
  const newEmail = isEmail(query) && !members.some((member) => member.email === words) && !emails.includes(words) ? words : null
  const count = picked.length + emails.length

  const toggle = (member: Member) => setPicked((current) => (current.includes(member) ? current.filter((one) => one !== member) : [...current, member]))
  const pickEmail = (address: string) => {
    setEmails((current) => [...current, address])
    setQuery('')
  }

  async function confirm() {
    setSaving(true)
    let waiting = 0
    try {
      for (const member of picked) await setMember.mutateAsync({ spaceId: space.id, memberId: member.id, role, current: null })
      for (const address of emails) if ((await invite.mutateAsync({ space, email: address, role })) === 'waiting') waiting += 1
      toast.success(
        waiting > 0
          ? `Added to ${space.name}. ${waiting === 1 ? 'One invitation waits' : `${waiting} invitations wait`} for an admin of ${org.name} to approve.`
          : `${count === 1 ? 'Added' : `${count} people added`} to ${space.name}.`,
      )
      onDone()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-[18px] font-[650] [font-family:var(--font-rounded)]">Add people to {space.name}</DialogTitle>
      </DialogHeader>

      <div className="bg-well flex h-10 items-center gap-2 rounded-md px-3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--brand)]">
        <Search className="text-quiet size-4 flex-none" />
        <input
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && newEmail) {
              event.preventDefault()
              pickEmail(newEmail)
            }
          }}
          placeholder="Search by name or email"
          aria-label="Search by name or email"
          autoComplete="off"
          className="placeholder:text-quiet/80 h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>

      {/* One list: emails to invite on top, then people in a fixed order, so checking one moves nothing. */}
      <ul className="border-line divide-line m-0 max-h-[280px] list-none divide-y overflow-y-auto rounded-md border p-0">
        {newEmail && (
          <li>
            <button type="button" onClick={() => pickEmail(newEmail)} className="hover:bg-ink/4 flex w-full items-center gap-3 px-3 py-2.5 text-left">
              <MailMark />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  Invite <span className="font-medium">{newEmail}</span>
                </span>
                <span className="text-quiet block text-[12.5px]">Not in {org.name} yet</span>
              </span>
              <span className="text-brand flex flex-none items-center gap-1 text-[12.5px] font-medium">
                <Plus className="size-3.5" />
                Add
              </span>
            </button>
          </li>
        )}
        {emails.map((address) => (
          <li key={address}>
            <PickRow chosen onClick={() => setEmails((current) => current.filter((one) => one !== address))} mark={<MailMark />} title={address} detail="Gets an email invite" />
          </li>
        ))}
        {shown.map((member) => (
          <li key={member.id}>
            <PickRow chosen={picked.includes(member)} onClick={() => toggle(member)} mark={<Avatar member={member} className="size-8" />} title={displayName(member)} detail={member.email} />
          </li>
        ))}
        {!newEmail && shown.length === 0 && (
          <li className="text-quiet px-3 py-6 text-center text-[13.5px]">
            {others.length === 0 ? `Everyone in ${org.name} is already here.` : `No one in ${org.name} matches.`} Enter a full email to invite someone new.
          </li>
        )}
      </ul>

      <div role="radiogroup" aria-label="Role in the space" className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((option) => (
          <Choice key={option.value} chosen={role === option.value} icon={option.value === 'admin' ? <Shield /> : <UserPlus />} label={option.label} detail={option.detail} onClick={() => setRole(option.value)} />
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={count === 0 || saving} onClick={confirm}>
          {saving ? 'Adding…' : confirmLabel(picked.length, emails.length)}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** What the Add people button does: "Add 2 people", "Invite 1 person", "Add 2, invite 1". */
function confirmLabel(adding: number, inviting: number) {
  const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`
  if (adding === 0 && inviting === 0) return 'Add people'
  if (inviting === 0) return `Add ${people(adding)}`
  if (adding === 0) return `Invite ${people(inviting)}`
  return `Add ${adding}, invite ${inviting}`
}

/** A row of Add people: its mark, a title over a detail, and a round check. Clicking toggles it. */
function PickRow({ chosen, onClick, mark, title, detail }: { chosen: boolean; onClick: () => void; mark: ReactNode; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={chosen}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', chosen ? 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]' : 'hover:bg-ink/4')}
    >
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="text-quiet block truncate text-[12.5px]">{detail}</span>
      </span>
      <span className={cn('grid size-5 flex-none place-items-center rounded-full border transition-colors', chosen ? 'bg-brand border-brand text-on-brand' : 'border-line')}>
        {chosen && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  )
}

/** Stands in for an avatar where there is only an email. */
function MailMark() {
  return (
    <span className="text-brand grid size-8 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_11%,transparent)]">
      <Mail className="size-4" />
    </span>
  )
}

function Groups({ space }: { space: Space }) {
  const groups = groupsOf(useGroups(), space.id).sort((a, b) => a.name.localeCompare(b.name))
  const links = useBoardLinks()
  const [creating, setCreating] = useState(false)

  return (
    <Panel
      title="Groups"
      count={groups.length}
      padded={false}
      action={
        <Button variant="outline" onClick={() => setCreating(true)}>
          <FolderPlus />
          New group
        </Button>
      }
    >
      {groups.length === 0 && <p className="text-quiet m-0 px-4 py-3">No groups yet. A group is a card on the board that holds related links.</p>}
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} count={links.filter((link) => link.group_id === group.id).length} />
      ))}
      <NewGroupDialog space={space} open={creating} onOpenChange={setCreating} />
    </Panel>
  )
}

function GroupRow({ group, count }: { group: Group; count: number }) {
  const [editing, setEditing] = useState(false)
  const confirm = useConfirm()
  const deleteGroup = useDeleteGroup()

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
      <span className="size-2.5 flex-none rounded-full bg-(--g)" style={{ '--g': colorValue(group.color) } as CSSProperties} />
      <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
      <span className="text-quiet text-[12.5px] tabular-nums">
        {count} {count === 1 ? 'link' : 'links'}
      </span>
      <RowMenu label={`More for ${group.name}`}>
        <DropdownMenuItem onClick={() => setEditing(true)}>
          <Pencil />
          Edit…
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            confirm({
              title: `Delete ${group.name}?`,
              description: count ? `The group and its ${count} ${count === 1 ? 'link' : 'links'} are removed for everyone.` : 'The group is removed.',
              confirmLabel: 'Delete group',
              onConfirm: () => deleteGroup.mutate(group.id, { onError: toastError }),
            })
          }
        >
          <Trash2 />
          Delete…
        </DropdownMenuItem>
      </RowMenu>
      <GroupDialog group={group} open={editing} onOpenChange={setEditing} />
    </div>
  )
}

function DangerZone({ space }: { space: Space }) {
  const confirm = useConfirm()
  const deleteSpace = useDeleteSpace()
  const openSpace = useOpenSpace()
  const groups = groupsOf(useGroups(), space.id)
  const links = useBoardLinks().filter((link) => link.space_id === space.id)

  return (
    <Panel title="Delete">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-quiet m-0 min-w-0 flex-1 basis-[240px] text-[13.5px]">
          Deletes all {groups.length} {groups.length === 1 ? 'group' : 'groups'} and {links.length} {links.length === 1 ? 'link' : 'links'} for everyone. This can't be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() =>
            confirm({
              title: `Delete ${space.name}?`,
              description: `Every group, link and file in ${space.name} is deleted for everyone. This can't be undone.`,
              confirmLabel: `Delete ${space.name}`,
              onConfirm: () =>
                deleteSpace.mutate(space.id, {
                  onError: toastError,
                  onSuccess: () => {
                    toast.success(`${space.name} was deleted.`)
                    openSpace(null)
                  },
                }),
            })
          }
        >
          <Trash2 />
          Delete space…
        </Button>
      </div>
    </Panel>
  )
}
