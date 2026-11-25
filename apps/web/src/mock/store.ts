// The mock backend's state: the database's rows, and the sign-in sessions this browser holds.
// Kept in localStorage so it survives the reloads the app makes on purpose (switching to an
// organization of another email, finishing a sign-in). "Reset" in the toolbar starts it over.

import type { Folder, Group, Link, Member, Org, Role, Space, SpaceMember, SpaceTeam, Team, TeamMember } from '@/lib/types'

export interface User {
  id: string
  email: string
  name: string
}

export interface Tables {
  users: User[]
  orgs: Org[]
  members: Member[]
  spaces: Space[]
  space_members: SpaceMember[]
  groups: Group[]
  folders: Folder[]
  links: Link[]
  link_access: { link_id: string; member_id: string }[]
  teams: Team[]
  team_members: TeamMember[]
  space_teams: SpaceTeam[]
  link_team_access: { link_id: string; team_id: string }[]
  group_access: { group_id: string; member_id: string }[]
  group_team_access: { group_id: string; team_id: string }[]
  member_prefs: ({ member_id: string } & Record<string, unknown>)[]
  /** Emails that may create organizations. */
  org_creators: string[]
}

export interface MockState {
  db: Tables
  /** Each session path's token (/api/auth/<slot>), as the cookies would hold them. */
  sessions: Record<string, string>
  /** Tokens that are still valid, and whose they are. Signing out removes one. */
  tokens: Record<string, string>
  /** The last sign-in link "emailed", until it is opened from the toolbar. */
  pendingLink: { email: string; callbackURL: string } | null
  /** The situation set up last: the toolbar's Reset sets it up again. */
  scenario: { id: string; role: Role }
  /** The screen opened last from the toolbar. */
  screen: string | null
  /** A screen whose steps (Screen.act) still have to run once its page has loaded. */
  act: string | null
  /** The text files written or saved in mock mode, by their key. The other files are made up when asked for (src/mock/files.ts). */
  files?: Record<string, string>
}

const KEY = 'teamshelf.mock'
const listeners = new Set<() => void>()
let state: MockState | null = null

export function getState(): MockState {
  if (state) return state
  try {
    state = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MockState | null
  } catch {
    state = null
  }
  if (!state) throw new Error('The mock backend has no data yet.')
  // Saved before there were folders, or teams.
  state.db.folders ??= []
  state.db.teams ??= []
  state.db.team_members ??= []
  state.db.space_teams ??= []
  state.db.link_team_access ??= []
  state.db.group_access ??= []
  state.db.group_team_access ??= []
  return state
}

export const hasState = () => {
  try {
    getState()
    return true
  } catch {
    return false
  }
}

export function setState(next: MockState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Without storage the mock still works until the next reload.
  }
  for (const listener of listeners) listener()
}

/** Changes the state in place and saves it. */
export function update(change: (draft: MockState) => void) {
  const draft = structuredClone(getState())
  change(draft)
  setState(draft)
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const uuid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

/** The user a session path is signed in as, if its token is still valid. */
export function userOfSlot(slot: string): User | null {
  const { sessions, tokens, db } = getState()
  const token = sessions[slot]
  const userId = token ? tokens[token] : undefined
  return db.users.find((user) => user.id === userId) ?? null
}

export function userOfToken(token: string | undefined): User | null {
  const { tokens, db } = getState()
  const userId = token ? tokens[token] : undefined
  return db.users.find((user) => user.id === userId) ?? null
}
