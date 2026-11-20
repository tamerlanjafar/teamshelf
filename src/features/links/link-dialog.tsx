import { createContext, useCallback, useContext, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useGroupsIfLoaded } from '@/api/groups'
import { useCategoriesIfLoaded } from '@/api/categories'
import { useAddLink, useBoardLinksIfLoaded, useLinkAccess, useUpdateLink } from '@/api/links'
import { useMembersIfLoaded } from '@/api/members'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AudiencePicker } from './audience-picker'
import { CategoryCombobox } from './category-combobox'
import { GroupCombobox } from './group-combobox'
import { draftOf, fieldsOf, hasErrors, newDraft, validate, type LinkDraft } from './link-draft'
import { suggestName } from './name-suggestion.ts'

/** What the dialog was opened for: a new link (optionally in a given group), or changing one. */
type Request = { kind: 'add'; groupName?: string } | { kind: 'edit'; link: Link }

interface LinkDialogApi {
  /** Opens the form for a new link. Whoever manages its category adds it, everyone else suggests it. */
  addLink: (groupName?: string) => void
  /** Opens the form for an existing link. For whoever manages it. */
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[18px] sm:max-w-[460px]">
          {request && <LinkForm key={request.count} request={request.value} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </LinkDialogContext>
  )
}

function LinkForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const { superAdmin, managedCategoryIds, canPublishIn } = usePermissions()
  const editing = request.kind === 'edit' ? request.link : null

  const groups = useGroupsIfLoaded()
  const categories = useCategoriesIfLoaded()
  const members = useMembersIfLoaded()
  const boardLinks = useBoardLinksIfLoaded()
  const savedAccess = useLinkAccess(editing?.visibility === 'members' ? editing.id : undefined)

  const [draft, setDraft] = useState<LinkDraft>(() => (editing ? draftOf(editing, groups) : newDraft(request.kind === 'add' ? request.groupName : '')))
  const [attempted, setAttempted] = useState(false)
  const addLink = useAddLink()
  const updateLink = useUpdateLink()
  const saving = addLink.isPending || updateLink.isPending

  // Whether the link goes straight to the board depends on its category: the super admin
  // publishes anywhere, a category's manager in their categories. Everything else waits for review.
  const publishes = canPublishIn(draft.categoryId)
  // A manager who edits a link can't move it out of the categories they manage.
  const offered = editing && !superAdmin ? categories.filter((category) => managedCategoryIds.includes(category.id)) : categories

  const memberIds = draft.memberIds ?? savedAccess.data ?? []
  const errors = validate(draft, memberIds)
  const shown = attempted ? errors : {}
  const formId = useId()
  const ids = { group: `${formId}-group`, title: `${formId}-title`, url: `${formId}-url`, category: `${formId}-category` }

  const change = (changes: Partial<LinkDraft>) => setDraft((current) => ({ ...current, ...changes }))

  // A name that mentions an environment in its own way ("jenkins staging online") gets a
  // proposal in the usual form, so the link lines up with its siblings on the board.
  const group = groups.find((candidate) => candidate.name.toLowerCase() === draft.groupName.trim().toLowerCase())
  const siblings = boardLinks.filter((link) => group && link.group_id === group.id && link.id !== editing?.id).map((link) => link.title)
  const [keptName, setKeptName] = useState<string | null>(null)
  const proposal = draft.title.trim() === keptName ? null : suggestName(draft.title, draft.groupName, siblings)

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    // With a proposal open, the person first says which name they want.
    if (hasErrors(errors) || proposal) return

    const fields = fieldsOf(draft, groups)
    const audience = { visibility: draft.visibility, memberIds }

    if (editing) {
      updateLink.mutate({ id: editing.id, fields, audience }, { onSuccess: onDone, onError: toastError })
      return
    }
    addLink.mutate(
      { fields, publishFor: publishes ? audience : undefined },
      {
        onError: toastError,
        onSuccess: () => {
          toast.success(publishes ? 'Added to the board.' : 'Sent for review. It appears on the board once it is approved.')
          onDone()
        },
      },
    )
  }

  const title = editing ? 'Edit link' : publishes ? 'Add a link' : 'Suggest a link'

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-[650] [font-family:var(--font-rounded)]">{title}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4">
        <FormRow id={ids.group} label="Group" error={shown.groupName}>
          <GroupCombobox id={ids.group} groups={groups} value={draft.groupName} invalid={Boolean(shown.groupName)} autoFocus={!draft.groupName} onChange={(groupName) => change({ groupName })} />
        </FormRow>
        <FormRow id={ids.title} label="Name" error={shown.title}>
          <Input
            id={ids.title}
            placeholder="Link name"
            autoComplete="off"
            autoFocus={Boolean(draft.groupName) && !editing}
            value={draft.title}
            maxLength={80}
            aria-invalid={Boolean(shown.title)}
            onChange={(event) => change({ title: event.target.value })}
            className="h-10"
          />
          {proposal && (
            <NameProposal proposal={proposal} urgent={attempted} onUse={() => change({ title: proposal })} onKeep={() => setKeptName(draft.title.trim())} />
          )}
        </FormRow>
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
        {offered.length > 0 && (
          <FormRow id={ids.category} label="Category">
            <CategoryCombobox id={ids.category} categories={offered} value={draft.categoryId} required={Boolean(editing) && !superAdmin} onChange={(categoryId) => change({ categoryId })} />
          </FormRow>
        )}
        {superAdmin && (
          <AudiencePicker
            visibility={draft.visibility}
            memberIds={memberIds}
            members={members}
            error={shown.audience}
            onChange={(visibility, nextIds) => change({ visibility, memberIds: nextIds })}
          />
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save' : publishes ? 'Add to board' : 'Send for review'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Shown under the name when it mentions an environment but not as "Thing - Environment".
 * One click takes the proposed name, another keeps what was typed. `urgent`: the person
 * tried to save without choosing.
 */
function NameProposal({ proposal, urgent, onUse, onKeep }: { proposal: string; urgent: boolean; onUse: () => void; onKeep: () => void }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg px-3 py-2.5 text-[13px]', urgent ? 'bg-destructive/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--destructive)_35%,transparent)]' : 'bg-muted')}>
      <span className="text-muted-foreground leading-snug">
        Write the environment after the name, so it lines up with the others on the board:
        <span className="text-foreground mt-0.5 block font-medium">{proposal}</span>
      </span>
      <span className="flex gap-2">
        <Button type="button" onClick={onUse}>
          Use this name
        </Button>
        <Button type="button" variant="ghost" onClick={onKeep}>
          Keep mine
        </Button>
      </span>
    </div>
  )
}

/** A label, the control it names, and the error under it. */
function FormRow({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error && <span className="text-destructive text-[12.5px]">{error}</span>}
    </div>
  )
}
