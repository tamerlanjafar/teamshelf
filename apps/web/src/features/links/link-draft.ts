// The state of the link form, and what makes it valid. Pure functions, no React.

import type { LinkFields } from '@/api/links'
import { MAX_FILE_BYTES, formatBytes, type StoredFile } from '@/api/files'
import type { Group, Link, LinkKind, Visibility } from '@/lib/types'
import { nameError, type NameContext } from './name-rules'

export interface LinkDraft {
  kind: LinkKind
  groupName: string
  /** A folder of the chosen group, or null for its top. */
  folderId: string | null
  title: string
  url: string
  /** The file picked for a new file. An edited file keeps the one it has. */
  file: File | null
  visibility: Visibility
  /** null until chosen: an edited link then keeps the people and teams it already has. */
  chosen: Chosen | null
}

/** The people and teams a link or a group is shown to, when its visibility is "members". */
export interface Chosen {
  memberIds: string[]
  teamIds: string[]
}

export const NO_ONE: Chosen = { memberIds: [], teamIds: [] }

/** Why an audience can't be saved: "members" with nobody chosen. */
export const audienceError = (visibility: Visibility, chosen: Chosen) =>
  visibility === 'members' && chosen.memberIds.length === 0 && chosen.teamIds.length === 0 ? 'Choose at least one team or person.' : undefined

export type DraftErrors = Partial<Record<'groupName' | 'title' | 'url' | 'file' | 'audience', string>>

export function newDraft(groupName = '', folderId: string | null = null): LinkDraft {
  return { kind: 'link', groupName, folderId, title: '', url: '', file: null, visibility: 'everyone', chosen: null }
}

export function draftOf(link: Link, groups: Group[]): LinkDraft {
  return {
    kind: link.kind,
    groupName: groups.find((group) => group.id === link.group_id)?.name ?? link.proposed_group ?? '',
    folderId: link.folder_id,
    title: link.title,
    url: link.kind === 'file' ? '' : link.url,
    file: null,
    visibility: link.visibility,
    chosen: null,
  }
}

/** The address as it is stored: with a scheme, or null when it isn't a web address. */
export function normalizeUrl(value: string): string | null {
  const text = value.trim()
  if (!text || /\s/.test(text)) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function validate(draft: LinkDraft, chosen: Chosen, names: Omit<NameContext, 'groupName'>, editing: boolean): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.groupName.trim()) errors.groupName = 'Choose a group, or type a name to create one.'
  else if (draft.groupName.trim().length > 60) errors.groupName = 'Keep the group name to 60 characters.'
  const title = nameError(draft.title, { ...names, groupName: draft.groupName })
  if (title) errors.title = title
  if (draft.kind === 'link' && !normalizeUrl(draft.url)) errors.url = 'Enter a web address, like https://example.com.'
  if (draft.kind === 'file' && !editing) {
    if (!draft.file) errors.file = 'Choose a file to upload.'
    else if (draft.file.size > MAX_FILE_BYTES) errors.file = `Files can be up to ${formatBytes(MAX_FILE_BYTES)}. This one is ${formatBytes(draft.file.size)}.`
    else if (draft.file.size === 0) errors.file = 'This file is empty.'
  }
  const audience = audienceError(draft.visibility, chosen)
  if (audience) errors.audience = audience
  return errors
}

export const hasErrors = (errors: DraftErrors) => Object.keys(errors).length > 0

/** What a valid draft saves. The group is one of the space's (matched ignoring case), or a new name. */
export function fieldsOf(draft: LinkDraft, spaceId: string, groups: Group[], file?: StoredFile): LinkFields {
  const name = draft.groupName.trim()
  const existing = groups.find((group) => group.space_id === spaceId && group.name.toLowerCase() === name.toLowerCase())
  return {
    spaceId,
    group: existing ? { id: existing.id } : { name },
    // A new group has no folders yet.
    folderId: existing ? draft.folderId : null,
    title: draft.title.trim(),
    ...(draft.kind === 'link' ? { url: normalizeUrl(draft.url)! } : {}),
    ...(file ? { file } : {}),
  }
}
