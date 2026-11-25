import { Check, MoreHorizontal, Pencil, Search, Trash2, Users, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from '@/components/ui/toast'
import { useMembers } from '@/api/members'
import { peopleOf, useCreateTeam, useDeleteTeam, useTeams, useUpdateTeam } from '@/api/teams'
import { Avatar } from '@/components/app/avatar'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Field, TextInput } from '@/components/app/form'
import { SheetGroup } from '@/components/app/page-sheet'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMe, useOrg } from '@/features/org/org-context'
import { errorMessage, toastError } from '@/lib/errors'
import { canEditTeam, displayName } from '@/lib/roles'
import type { Member, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The organization's teams: named sets of people. A private space, a group or a link can be
 * given to a team instead of to its people one by one, and follows the team as it changes.
 * Everyone here sees every team; Org Admins change any of them, and the people they let manage
 * teams change only the ones they created.
 */
export function Teams() {
  const org = useOrg()
  const me = useMe()
  const data = useTeams()
  const members = useMembers()
  const [editing, setEditing] = useState<Team | 'new' | null>(null)

  return (
    <SheetGroup
      title="Teams"
      count={data.teams.length}
      action={
        <Button variant="outline" onClick={() => setEditing('new')}>
          <UsersRound />
          New team
        </Button>
      }
    >
      {data.teams.length === 0 && (
        <p className="text-quiet m-0 px-4 py-3 text-[13.5px] leading-relaxed">
          No teams yet. Put people of {org.name} in a team to give it a private space, a group or a link all at once.
        </p>
      )}
      {data.teams.map((team) => (
        <TeamRow key={team.id} team={team} editable={canEditTeam(me, team)} creator={members.find((member) => member.id === team.created_by)} people={peopleOf(data, team.id).map((id) => members.find((member) => member.id === id)).filter((member): member is Member => Boolean(member))} onEdit={() => setEditing(team)} />
      ))}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="rounded-xl sm:max-w-[520px]">
          {editing !== null && <TeamForm team={editing === 'new' ? null : editing} current={editing === 'new' ? [] : peopleOf(data, editing.id)} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </SheetGroup>
  )
}

/** Who is in a team, the way you'd say it: "Priya Nair, Sam Lee and 3 more". */
function peopleLine(people: Member[]) {
  if (people.length === 0) return 'Nobody in it yet'
  const names = people.map(displayName).sort((a, b) => a.localeCompare(b))
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

function TeamRow({ team, editable, creator, people, onEdit }: { team: Team; editable: boolean; creator?: Member; people: Member[]; onEdit: () => void }) {
  const org = useOrg()
  const confirm = useConfirm()
  const deleteTeam = useDeleteTeam()

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="bg-well text-quiet grid size-9 flex-none place-items-center rounded-full">
        <Users className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{team.name}</span>
          {/* Someone who manages teams sees who runs the ones they can't change. */}
          {!editable && creator && <span className="text-quiet flex-none truncate text-[12.5px]">by {displayName(creator)}</span>}
        </div>
        <div className="text-quiet truncate text-[13px]">{peopleLine(people)}</div>
      </div>
      <span className="text-quiet flex-none text-[12.5px] tabular-nums max-sm:hidden">
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </span>
      {!editable ? (
        <span className="w-8 flex-none" aria-hidden="true" />
      ) : (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`More for ${team.name}`} className="text-quiet hover:text-ink hover:bg-accent data-[popup-open]:bg-accent grid size-8 flex-none place-items-center rounded-md">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Edit…
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              confirm({
                title: `Delete ${team.name}?`,
                description: `The spaces, groups and links given to ${team.name} are no longer seen through it. Its people stay in ${org.name}.`,
                confirmLabel: 'Delete team',
                onConfirm: () => deleteTeam.mutate(team.id, { onSuccess: () => toast.success(`${team.name} was deleted.`), onError: toastError }),
              })
            }
          >
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  )
}

/** A team's name and its people, picked from everyone in the organization. Creates a team, or (with one) changes it. */
function TeamForm({ team, current, onDone }: { team: Team | null; current: string[]; onDone: () => void }) {
  const org = useOrg()
  const members = useMembers()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()
  const [name, setName] = useState(team?.name ?? '')
  const [picked, setPicked] = useState<string[]>(current)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()
  const saving = createTeam.isPending || updateTeam.isPending

  const words = query.trim().toLowerCase()
  // Everyone who is in the organization (invitations still waiting for approval aside), by name.
  const people = members.filter((member) => member.approved).sort((a, b) => displayName(a).localeCompare(displayName(b)))
  // Picked people stay listed while the search hides others.
  const shown = people.filter((member) => picked.includes(member.id) || !words || `${displayName(member)} ${member.email}`.toLowerCase().includes(words))
  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id]))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    // A taken name is said under the name; anything else in a toast.
    const onError = (error: unknown) => (errorMessage(error).startsWith('There is already a team') ? setError(errorMessage(error)) : toastError(error))
    const done = { onSuccess: onDone, onError }
    if (team) updateTeam.mutate({ team, name, memberIds: picked, current }, done)
    else
      createTeam.mutate(
        { name, memberIds: picked },
        {
          ...done,
          onSuccess: () => {
            toast.success(`${name.trim()} was created.`)
            onDone()
          },
        },
      )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-[18px] font-[650] [font-family:var(--font-rounded)]">{team ? `Edit ${team.name}` : 'New team'}</DialogTitle>
      </DialogHeader>
      <Field label="Name" error={error}>
        <TextInput
          value={name}
          maxLength={40}
          placeholder="Backend, On call, Leads…"
          autoFocus={!team}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setName(event.target.value)
            setError(undefined)
          }}
        />
      </Field>

      <div className="grid gap-2">
        <span className="text-[13px] font-medium">People</span>
        <div className="bg-well flex h-10 items-center gap-2 rounded-md px-3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--brand)]">
          <Search className="text-quiet size-4 flex-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            autoComplete="off"
            className="placeholder:text-quiet/80 h-full min-w-0 flex-1 bg-transparent outline-none"
          />
        </div>
        <ul className="border-line divide-line m-0 max-h-[280px] list-none divide-y overflow-y-auto rounded-md border p-0">
          {shown.map((member) => {
            const chosen = picked.includes(member.id)
            return (
              <li key={member.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={chosen}
                  onClick={() => toggle(member.id)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', chosen ? 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]' : 'hover:bg-ink/4')}
                >
                  <Avatar member={member} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(member)}</span>
                    <span className="text-quiet block truncate text-[12.5px]">{member.email}</span>
                  </span>
                  <span className={cn('grid size-5 flex-none place-items-center rounded-full border transition-colors', chosen ? 'bg-brand border-brand text-on-brand' : 'border-line')}>
                    {chosen && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })}
          {shown.length === 0 && <li className="text-quiet px-3 py-6 text-center text-[13.5px]">No one in {org.name} matches.</li>}
        </ul>
        <span className="text-quiet text-[12.5px]">{picked.length === 0 ? 'No one picked yet' : `${picked.length} ${picked.length === 1 ? 'person' : 'people'} picked`}</span>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {team ? 'Save' : 'Create team'}
        </Button>
      </DialogFooter>
    </form>
  )
}
