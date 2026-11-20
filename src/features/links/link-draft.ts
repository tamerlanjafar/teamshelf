// The state of the link form, and what makes it valid. Pure functions, no React.

import type { LinkFields } from '@/api/links'
import { MAX_FILE_BYTES, formatBytes, type StoredFile } from '@/api/files'
import type { Group, Link, LinkKind, Visibility } from '@/lib/types'
import { nameError, type NameContext } from './name-rules'

export interface LinkDraft {
  kind: LinkKind
  groupName: string
  title: string
  url: string
  /** The file picked for a new file. An edited file keeps the one it has. */
  file: File | null
  visibility: Visibility
  /** null until chosen: an edited link then keeps the people it already has. */
  memberIds: string[] | null
}

export type DraftErrors = Partial<Record<'groupName' | 'title' | 'url' | 'file' | 'audience', string>>

export function newDraft(groupName = ''): LinkDraft {
  return { kind: 'link', groupName, title: '', url: '', file: null, visibility: 'everyone', memberIds: null }
}

export function draftOf(link: Link, groups: Group[]): LinkDraft {
  return {
    kind: link.kind,
    groupName: groups.find((group) => group.id === link.group_id)?.name ?? link.proposed_group ?? '',
    title: link.title,
    url: link.kind === 'file' ? '' : link.url,
    file: null,
    visibility: link.visibility,
    memberIds: null,
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

export function validate(draft: LinkDraft, memberIds: string[], names: Omit<NameContext, 'groupName'>, editing: boolean): DraftErrors {
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
  if (draft.visibility === 'members' && memberIds.length === 0) errors.audience = 'Choose at least one person.'
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
    title: draft.title.trim(),
    ...(draft.kind === 'link' ? { url: normalizeUrl(draft.url)! } : {}),
    ...(file ? { file } : {}),
  }
}
