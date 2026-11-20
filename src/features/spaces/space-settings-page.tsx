import { Navigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, FolderPlus, Globe, Lock, MoreHorizontal, Palette, Plus, Trash2, UserMinus, X } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { groupsOf, useDeleteGroup, useGroups } from '@/api/groups'
import { useBoardLinks } from '@/api/links'
import { useMembers } from '@/api/members'
import { useDeleteSpace, useSetSpaceMember, useSpaceMembersIfLoaded, useUpdateSpace } from '@/api/spaces'
import { Avatar } from '@/components/app/avatar'
import { ColorPicker } from '@/components/app/color-picker'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Field, Segmented, TextInput } from '@/components/app/form'
import { PageSheet, SheetGroup } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GroupDialog } from '@/features/board/group-dialog'
import { useMe, useOrg } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { colorValue } from '@/lib/colors'
import { KNOWN_ENVIRONMENTS, splitName } from '@/lib/environments'
import { toastError } from '@/lib/errors'
import { displayName, isSuperAdmin } from '@/lib/roles'
import type { Color, Group, Member, Space, SpaceRole, SpaceVisibility } from '@/lib/types'
import { useCurrentSpace, useOpenSpace } from './current-space'
import { LogoPicker } from './logo-picker'
import { NewGroupDialog } from './new-group-dialog'
import { SpaceLogo } from './space-logo'

/**
 * Everything about one space, for its admins: its name and logo, who sees it, the environments
 * its links may name, its people, its groups, and deleting it.
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
    <PageSheet title={`${space.name} settings`} lead={`${space.name}'s admins can change all of this, add and review its links, and arrange its board.`}>
      {/* Keyed by space, so each form starts from the space it shows. */}
      <Identity key={`identity-${space.id}`} space={space} />
      <Visibility space={space} />
      <Environments key={`environments-${space.id}`} space={space} />
      <People space={space} />
      <Groups space={space} />
      <DangerZone space={space} />
    </PageSheet>
  )
}

/** A titled part of the page, in one rounded box. */
function Panel({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2.5">
      <div className="mx-1">
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        {lead && <p className="text-quiet m-0 mt-0.5 max-w-[60ch] text-[13.5px] leading-relaxed">{lead}</p>}
      </div>
      <div className="bg-raised border-line grid min-w-0 gap-4 rounded-[14px] border p-4 sm:p-5">{children}</div>
    </section>
  )
}

function Identity({ space }: { space: Space }) {
  const [name, setName] = useState(space.name)
  const [logo, setLogo] = useState(space.logo)
  const [color, setColor] = useState<Color>(space.color)
  const updateSpace = useUpdateSpace()
  const changed = name.trim() !== space.name || logo !== space.logo || color !== space.color

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    updateSpace.mutate({ id: space.id, changes: { name: name.trim(), logo, color } }, { onSuccess: () => toast.success('Saved.'), onError: toastError })
  }

  return (
    <form onSubmit={submit}>
      <Panel title="Name and logo">
        <div className="flex min-w-0 items-center gap-3">
          <SpaceLogo space={{ name, logo, color }} className="size-12 rounded-[13px]" />
          <Field label="Name" className="min-w-0 flex-1">
            <TextInput value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-2">
          <span className="text-[13px] font-medium">Logo</span>
          <LogoPicker space={{ name, logo, color }} onChange={setLogo} />
        </div>
        <div className="grid gap-2">
          <span className="text-[13px] font-medium">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!changed || !name.trim() || updateSpace.isPending}>
            Save
          </Button>
        </div>
      </Panel>
    </form>
  )
}

const VISIBILITY: { value: SpaceVisibility; label: ReactNode }[] = [
  {
    value: 'org',
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Globe className="size-3.5" />
        Organization
      </span>
    ),
  },
  {
    value: 'private',
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Lock className="size-3.5" />
        Private
      </span>
    ),
  },
]

function Visibility({ space }: { space: Space }) {
  const org = useOrg()
  const updateSpace = useUpdateSpace()
  const confirm = useConfirm()

  function change(visibility: SpaceVisibility) {
    if (visibility === space.visibility) return
    const apply = () => updateSpace.mutate({ id: space.id, changes: { visibility } }, { onError: toastError })
    if (visibility === 'org') apply()
    else
      confirm({
        title: `Make ${space.name} private?`,
        description: `Only the people listed under People will see ${space.name} and its links. Everyone else in ${org.name}, and everyone who joins later, won't see it at all.`,
        confirmLabel: 'Make private',
        onConfirm: apply,
      })
  }

  return (
    <Panel
      title="Who sees it"
      lead={
        space.visibility === 'org'
          ? `Everyone in ${org.name} sees ${space.name} and can suggest links, including people who join later.`
          : `Only ${space.name}'s people see it. Joining ${org.name} doesn't show it to anyone.`
      }
    >
      <Segmented label="Who sees it" options={VISIBILITY} value={space.visibility} onChange={change} className="flex w-full sm:w-fit" />
    </Panel>
  )
}

/** The names that may follow " - " in a link's name, in the order a line on the board shows them. */
function Environments({ space }: { space: Space }) {
  const updateSpace = useUpdateSpace()
  const links = useBoardLinks().filter((link) => link.space_id === space.id)
  const [adding, setAdding] = useState('')
  const used = (environment: string) => links.filter((link) => splitName(link.title).environment === environment).length

  const typed = adding.trim().replace(/\s+/g, '')
  const value = typed && typed[0].toUpperCase() + typed.slice(1)
  const problem = !value
    ? null
    : !/^[A-Z][A-Za-z0-9]{0,15}$/.test(value)
      ? 'Use one word of letters and digits, up to 16 characters.'
      : space.environments.some((environment) => environment.toLowerCase() === value.toLowerCase())
        ? `${value} is already in the list.`
        : space.environments.length >= 16
          ? 'A space can have up to 16 environments.'
          : null

  const save = (environments: string[]) => updateSpace.mutate({ id: space.id, changes: { environments } }, { onError: toastError })

  function add(event: FormEvent) {
    event.preventDefault()
    if (!value || problem) return
    save([...space.environments, value])
    setAdding('')
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...space.environments]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    save(next)
  }

  const suggestions = KNOWN_ENVIRONMENTS.filter((environment) => !space.environments.includes(environment))

  return (
    <Panel
      title="Environments"
      lead={
        <>
          A link for one environment ends with “ - ” and one of these, like <span className="text-ink">Online - {space.environments[0] ?? 'Prod'}</span>. Links of one thing share a line on the
          board, in this order.
        </>
      }
    >
      {space.environments.length === 0 ? (
        <p className="text-quiet m-0">No environments. Names can't end with “ - ” and an environment.</p>
      ) : (
        <ol className="divide-line m-0 grid list-none divide-y p-0">
          {space.environments.map((environment, index) => (
            <li key={environment} className="flex min-w-0 items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate font-medium">{environment}</span>
              <span className="text-quiet text-[12.5px] tabular-nums">{used(environment) ? `${used(environment)} ${used(environment) === 1 ? 'link' : 'links'}` : ''}</span>
              <IconAction label={`Move ${environment} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </IconAction>
              <IconAction label={`Move ${environment} down`} disabled={index === space.environments.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </IconAction>
              <IconAction
                label={`Remove ${environment}`}
                onClick={() => save(space.environments.filter((other) => other !== environment))}
                title={used(environment) ? `${used(environment)} links still use it. They stay, but can't be saved again until renamed.` : undefined}
              >
                <X />
              </IconAction>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="flex min-w-0 flex-wrap items-start gap-2">
        <Field label="Add an environment" error={problem ?? undefined} className="min-w-0 flex-1 basis-[180px]">
          <TextInput value={adding} maxLength={16} placeholder="Dev" list={`environments-${space.id}`} aria-invalid={Boolean(problem)} onChange={(event) => setAdding(event.target.value)} />
        </Field>
        <datalist id={`environments-${space.id}`}>
          {suggestions.map((environment) => (
            <option key={environment} value={environment} />
          ))}
        </datalist>
        <Button type="submit" variant="outline" className="mt-[22px]" disabled={!value || Boolean(problem) || updateSpace.isPending}>
          <Plus />
          Add
        </Button>
      </form>
    </Panel>
  )
}

const ROLES: { value: SpaceRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
]

function People({ space }: { space: Space }) {
  const org = useOrg()
  const me = useMe()
  const members = useMembers()
  const rows = useSpaceMembersIfLoaded().filter((row) => row.space_id === space.id)
  const setMember = useSetSpaceMember()
  const [adding, setAdding] = useState('')

  const inSpace = rows.map((row) => ({ row, member: members.find((member) => member.id === row.member_id) })).filter((entry): entry is { row: (typeof rows)[number]; member: Member } => Boolean(entry.member))
  inSpace.sort((a, b) => (a.row.role === b.row.role ? displayName(a.member).localeCompare(displayName(b.member)) : a.row.role === 'admin' ? -1 : 1))
  const others = members.filter((member) => !isSuperAdmin(member) && !rows.some((row) => row.member_id === member.id)).sort((a, b) => displayName(a).localeCompare(displayName(b)))
  const admins = rows.filter((row) => row.role === 'admin').length

  const set = (member: Member, role: SpaceRole | null, current: SpaceRole | null) =>
    setMember.mutate({ spaceId: space.id, memberId: member.id, role, current }, { onError: toastError })

  return (
    <section className="grid min-w-0 gap-2.5">
      <div className="mx-1">
        <h2 className="m-0 text-[15px] font-semibold">People</h2>
        <p className="text-quiet m-0 mt-0.5 max-w-[60ch] text-[13.5px] leading-relaxed">
          Admins run the space. {space.visibility === 'private' ? 'Members see it and suggest links.' : `Everyone in ${org.name} already sees it; list members here so they keep it if it becomes private.`} The super admin of{' '}
          {org.name} is an admin of every space.
        </p>
      </div>
      <form
        className="flex min-w-0 flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const member = others.find((other) => other.id === adding)
          if (member) set(member, 'member', null)
          setAdding('')
        }}
      >
        <select
          aria-label="Person to add"
          value={adding}
          onChange={(event) => setAdding(event.target.value)}
          className="bg-well text-ink h-9 min-w-0 flex-1 basis-[200px] rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1px_var(--brand)]"
        >
          <option value="">{others.length ? `Add someone from ${org.name}…` : `Everyone in ${org.name} is in this space`}</option>
          {others.map((member) => (
            <option key={member.id} value={member.id}>
              {displayName(member)} · {member.email}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={!adding || setMember.isPending}>
          <Plus />
          Add
        </Button>
      </form>
      <SheetGroup title="In this space" count={inSpace.length}>
        {inSpace.length === 0 && <p className="text-quiet m-0 px-4 py-3">Nobody yet.</p>}
        {inSpace.map(({ row, member }) => {
          const lastAdmin = row.role === 'admin' && admins === 1
          return (
            <div key={member.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Avatar member={member} />
              <div className="min-w-0 flex-1 basis-[140px]">
                <div className="truncate font-medium">
                  {displayName(member)}
                  {member.id === me.id && <span className="text-quiet font-normal"> (you)</span>}
                </div>
                <div className="text-quiet truncate text-[12.5px]">{member.email}</div>
              </div>
              <Segmented
                label={`Role of ${displayName(member)} in ${space.name}`}
                options={ROLES}
                value={row.role}
                onChange={(role) => role !== row.role && !lastAdmin && set(member, role, row.role)}
              />
              <IconAction
                label={`Take ${displayName(member)} out of ${space.name}`}
                disabled={lastAdmin}
                title={lastAdmin ? 'A space keeps at least one admin.' : undefined}
                onClick={() => set(member, null, row.role)}
              >
                <UserMinus />
              </IconAction>
            </div>
          )
        })}
      </SheetGroup>
    </section>
  )
}

function Groups({ space }: { space: Space }) {
  const groups = groupsOf(useGroups(), space.id).sort((a, b) => a.name.localeCompare(b.name))
  const links = useBoardLinks()
  const [creating, setCreating] = useState(false)

  return (
    <section className="grid min-w-0 gap-2.5">
      <SheetGroup
        title="Groups"
        count={groups.length}
        action={
          <Button variant="outline" onClick={() => setCreating(true)}>
            <FolderPlus />
            New group
          </Button>
        }
      >
        {groups.length === 0 && <p className="text-quiet m-0 px-4 py-3">No groups yet. A group is a card on the board, like Jenkins or Figma.</p>}
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} count={links.filter((link) => link.group_id === group.id).length} />
        ))}
      </SheetGroup>
      <p className="text-quiet m-0 mx-1 text-[12.5px]">To arrange the board, drag cards by their name to any column and place. Everyone sees your arrangement.</p>
      <NewGroupDialog space={space} open={creating} onOpenChange={setCreating} />
    </section>
  )
}

function GroupRow({ group, count }: { group: Group; count: number }) {
  const [editing, setEditing] = useState(false)
  const confirm = useConfirm()
  const deleteGroup = useDeleteGroup()

  return (
    <div className="flex min-w-0 items-center gap-2 px-4 py-2.5">
      <span className="size-2.5 flex-none rounded-full bg-(--g)" style={{ '--g': colorValue(group.color) } as CSSProperties} />
      <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
      <span className="text-quiet text-[12.5px] tabular-nums">
        {count} {count === 1 ? 'link' : 'links'}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`More for ${group.name}`} className="text-quiet hover:text-ink hover:bg-accent data-[popup-open]:bg-accent grid size-8 flex-none place-items-center rounded-lg">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Palette />
            Name and color…
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
        </DropdownMenuContent>
      </DropdownMenu>
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
    <Panel title="Delete the space">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-quiet m-0 min-w-0 flex-1 basis-[240px] text-[13.5px]">
          Removes {space.name}, its {groups.length} {groups.length === 1 ? 'group' : 'groups'} and {links.length} {links.length === 1 ? 'link' : 'links and files'}, for everyone. This can't be undone.
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

function IconAction({ label, title, disabled, onClick, children }: { label: string; title?: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="text-quiet hover:text-ink hover:bg-accent grid size-8 flex-none place-items-center rounded-lg disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
