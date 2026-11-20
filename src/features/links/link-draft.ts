// The state of the link form, and what makes it valid. Pure functions, no React.

import type { LinkFields } from '@/api/links'
import type { Group, Link, Visibility } from '@/lib/types'

export interface LinkDraft {
  groupName: string
  title: string
  url: string
  categoryId: string | null
  visibility: Visibility
  /** null until chosen: an edited link then keeps the people it already has. */
  memberIds: string[] | null
}

export type DraftErrors = Partial<Record<'groupName' | 'title' | 'url' | 'audience', string>>

export function newDraft(groupName = ''): LinkDraft {
  return { groupName, title: '', url: '', categoryId: null, visibility: 'everyone', memberIds: null }
}

export function draftOf(link: Link, groups: Group[]): LinkDraft {
  return {
    groupName: groups.find((group) => group.id === link.group_id)?.name ?? link.proposed_group ?? '',
    title: link.title,
    url: link.url,
    categoryId: link.category_id,
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

export function validate(draft: LinkDraft, memberIds: string[]): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.groupName.trim()) errors.groupName = 'Choose a group, or type a name to create one.'
  if (!draft.title.trim()) errors.title = 'Give the link a name.'
  if (!normalizeUrl(draft.url)) errors.url = 'Enter a web address, like https://example.com.'
  if (draft.visibility === 'members' && memberIds.length === 0) errors.audience = 'Choose at least one person.'
  return errors
}

export const hasErrors = (errors: DraftErrors) => Object.keys(errors).length > 0

/** What a valid draft saves. The group is an existing one (matched ignoring case), or a new name. */
export function fieldsOf(draft: LinkDraft, groups: Group[]): LinkFields {
  const name = draft.groupName.trim()
  const existing = groups.find((group) => group.name.toLowerCase() === name.toLowerCase())
  return {
    group: existing ? { id: existing.id } : { name },
    title: draft.title,
    url: normalizeUrl(draft.url)!,
    categoryId: draft.categoryId,
  }
}
