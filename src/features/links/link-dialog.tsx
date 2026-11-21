import { createContext, useCallback, useContext, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { uploadFile } from '@/api/files'
import { groupsOf, useGroupsIfLoaded } from '@/api/groups'
import { useAddLink, useBoardLinksIfLoaded, useLinkAccess, useUpdateLink } from '@/api/links'
import { useMembersIfLoaded } from '@/api/members'
import { useSpaceMembersIfLoaded, useSpacesIfLoaded } from '@/api/spaces'
import { Segmented } from '@/components/app/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { toastError } from '@/lib/errors'
import type { Link, LinkKind } from '@/lib/types'
import { AudiencePicker } from './audience-picker'
import { FilePicker } from './file-picker'
import { GroupCombobox } from './group-combobox'
import { draftOf, fieldsOf, hasErrors, newDraft, validate, type LinkDraft } from './link-draft'
import { nameFromFile, NAME_MAX } from './name-rules'

/** What the dialog was opened for: a new link (optionally in a given group), or changing one. */
type Request = { kind: 'add'; groupName?: string } | { kind: 'edit'; link: Link }

interface LinkDialogApi {
  /** Opens the form for a new link in the open space. Its admins add it, everyone else suggests it. */
  addLink: (groupName?: string) => void
  /** Opens the form for an existing link. For the admins of its space. */
  editLink: (link: Link) => void
}

const LinkDialogContext = createContext<LinkDialogApi | null>(null)

export function useLinkDialog() {
  const api = useContext(LinkDialogContext)
  if (!api) throw new Error('useLinkDialog needs a LinkDialogProvider above it.')
  return api
}

/** Holds the one link dialog of the app, so any page can open it. */
export function LinkDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // The last request stays while the dialog animates out. The count gives every opening a fresh form.
  const [request, setRequest] = useState<{ count: number; value: Request } | null>(null)

  const show = useCallback((value: Request) => {
    setRequest((previous) => ({ count: (previous?.count ?? 0) + 1, value }))
    setOpen(true)
  }, [])

  const api = useMemo<LinkDialogApi>(
    () => ({
      addLink: (groupName) => show({ kind: 'add', groupName }),
      editLink: (link) => show({ kind: 'edit', link }),
    }),
    [show],
  )

  return (
    <LinkDialogContext value={api}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl sm:max-w-[460px]">
          {request && <LinkForm key={request.count} request={request.value} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </LinkDialogContext>
  )
}

function LinkForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const { isSpaceAdmin } = usePermissions()
  const editing = request.kind === 'edit' ? request.link : null

  const currentSpace = useCurrentSpaceIfLoaded()
  const spaces = useSpacesIfLoaded()
  const space = editing ? (spaces.find((candidate) => candidate.id === editing.space_id) ?? null) : currentSpace
  const groups = groupsOf(useGroupsIfLoaded(), space?.id)
  const members = useMembersIfLoaded()
  const spaceMembers = useSpaceMembersIfLoaded()
  const boardLinks = useBoardLinksIfLoaded()
  const savedAccess = useLinkAccess(editing?.visibility === 'members' ? editing.id : undefined)

  const [draft, setDraft] = useState<LinkDraft>(() => (editing ? draftOf(editing, groups) : newDraft(request.kind === 'add' ? request.groupName : '')))
  const [attempted, setAttempted] = useState(false)
  // The name's error shows once the person has left the field, or tried to save.
  const [nameTouched, setNameTouched] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const addLink = useAddLink()
  const updateLink = useUpdateLink()
  const saving = addLink.isPending || updateLink.isPending || progress !== null

  // An admin of the space adds straight to the board. Everyone else's link waits for review.
  const publishes = isSpaceAdmin(space?.id)

  // Who a link can be shown to: people who can see the space (only its members, for a private one).
  const choosable = space?.visibility === 'private' ? members.filter((member) => spaceMembers.some((row) => row.space_id === space.id && row.member_id === member.id)) : members

  const group = groups.find((candidate) => candidate.name.toLowerCase() === draft.groupName.trim().toLowerCase())
  const siblings = boardLinks.filter((link) => group && link.group_id === group.id && link.id !== editing?.id).map((link) => link.title)
  const memberIds = draft.memberIds ?? savedAccess.data ?? []
  const errors = validate(draft, memberIds, { siblings }, Boolean(editing))
  const shown = attempted ? errors : { ...(nameTouched && draft.title.trim() ? { title: errors.title } : {}) }

  const formId = useId()
  const ids = { group: `${formId}-group`, title: `${formId}-title`, url: `${formId}-url`, file: `${formId}-file` }
  const change = (changes: Partial<LinkDraft>) => setDraft((current) => ({ ...current, ...changes }))

  function pickFile(file: File | null) {
    // A name is offered from the file's own name, until the person writes one themselves.
    const offered = draft.file ? nameFromFile(draft.file.name) : ''
    change({ file, ...(file && (!draft.title.trim() || draft.title === offered) ? { title: nameFromFile(file.name) } : {}) })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (hasErrors(errors) || !space) return

    const audience = { visibility: draft.visibility, memberIds }
    if (editing) {
      updateLink.mutate({ id: editing.id, fields: fieldsOf(draft, space.id, groups), audience }, { onSuccess: onDone, onError: toastError })
      return
    }

    let stored
    if (draft.kind === 'file') {
      try {
        setProgress(0)
        stored = await uploadFile(space.id, draft.file!, setProgress)
      } catch (error) {
        setProgress(null)
        toastError(error)
        return
      }
    }
    addLink.mutate(
      { fields: fieldsOf(draft, space.id, groups, stored), publishFor: publishes ? audience : undefined },
      {
        onError: toastError,
        onSettled: () => setProgress(null),
        onSuccess: () => {
          const what = draft.kind === 'file' ? 'file' : 'link'
          toast.success(publishes ? `Added to ${space.name}.` : `Sent for review. The ${what} appears in ${space.name} once an admin approves it.`)
          onDone()
        },
      },
    )
  }

  const thing = draft.kind === 'file' ? 'file' : 'link'
  const title = editing ? `Edit ${thing}` : publishes ? `Add a ${thing}` : `Suggest a ${thing}`
  const submitLabel = progress !== null ? (progress < 1 ? `Uploading ${Math.round(progress * 100)}%…` : 'Saving…') : saving ? 'Saving…' : editing ? 'Save' : publishes ? `Add to ${space?.name ?? 'board'}` : 'Send for review'

  if (!space) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">No space to add to</DialogTitle>
        </DialogHeader>
        <p className="text-quiet m-0">Links live in spaces, and you aren't in any yet. Ask a space's admin to add you.</p>
        <DialogFooter>
          <Button size="lg" onClick={onDone}>
            OK
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid min-w-0 gap-5">
      <DialogHeader className="min-w-0">
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">{title}</DialogTitle>
        <span className="text-quiet flex min-w-0 items-center gap-2 text-[13px]">
          <SpaceLogo space={space} className="size-5 rounded-xs" />
          <span className="truncate">in {space.name}</span>
        </span>
      </DialogHeader>

      <div className="grid min-w-0 gap-4">
        {!editing && (
          <Segmented<LinkKind>
            label="What to add"
            options={[
              { value: 'link', label: 'Web address' },
              { value: 'file', label: 'File' },
            ]}
            value={draft.kind}
            onChange={(kind) => change({ kind })}
            className="flex"
          />
        )}
        {draft.kind === 'file' && !editing && (
          <FormRow id={ids.file} label="File" error={shown.file}>
            <FilePicker id={ids.file} file={draft.file} invalid={Boolean(shown.file)} disabled={saving} onChange={pickFile} />
          </FormRow>
        )}
        <FormRow id={ids.group} label="Group" error={shown.groupName}>
          <GroupCombobox id={ids.group} groups={groups} value={draft.groupName} invalid={Boolean(shown.groupName)} autoFocus={!draft.groupName} onChange={(groupName) => change({ groupName })} />
        </FormRow>
        <FormRow id={ids.title} label="Name" error={shown.title}>
          <Input
            id={ids.title}
            placeholder={draft.kind === 'file' ? 'Brand guidelines' : 'Team wiki'}
            autoComplete="off"
            autoFocus={Boolean(draft.groupName) && !editing}
            value={draft.title}
            maxLength={NAME_MAX + 20}
            aria-invalid={Boolean(shown.title)}
            onChange={(event) => change({ title: event.target.value })}
            onBlur={() => setNameTouched(true)}
            className="h-10"
          />
        </FormRow>
        {draft.kind === 'link' && (
          <FormRow id={ids.url} label="Address" error={shown.url}>
            <Input
              id={ids.url}
              type="url"
              inputMode="url"
              placeholder="https://"
              autoComplete="off"
              spellCheck={false}
              value={draft.url}
              aria-invalid={Boolean(shown.url)}
              onChange={(event) => change({ url: event.target.value })}
              className="h-10"
            />
          </FormRow>
        )}
        {publishes && (
          <AudiencePicker
            space={space}
            visibility={draft.visibility}
            memberIds={memberIds}
            members={choosable}
            error={shown.audience}
            onChange={(visibility, nextIds) => change({ visibility, memberIds: nextIds })}
          />
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={progress !== null}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving} className="min-w-0">
          <span className="truncate">{submitLabel}</span>
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A label, the control it names, and the error (or a hint) under it. */
function FormRow({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-destructive text-[12.5px] leading-snug">
          {error}
        </span>
      ) : (
        hint && <span className="text-quiet text-[12.5px] leading-snug">{hint}</span>
      )}
    </div>
  )
}
