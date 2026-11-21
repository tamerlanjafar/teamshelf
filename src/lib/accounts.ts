// Several organizations signed in at once, each with its own email if need be.
//
// The app shows organizations, not accounts: each one is listed with the email it is signed in
// with, and signing out leaves one organization. Underneath, an account (an email) may hold the
// sessions of several organizations, and that is what this file keeps track of.
//
// Each organization's session is a cookie kept at /api/auth/<org> (netlify/lib/auth-proxy.mjs).
// A page uses one session, picked when it loads: the one of the organization in its address, or
// the last one used for pages outside an organization. Going to an organization of another
// account loads the page again, with that organization's session. (Neon's client keeps one
// session per page, so two accounts can't share a page.)
//
// This browser's list of accounts is remembered here, to show them in the menus. The cookies are
// what counts: losing the list only loses the menus, not the sessions.

import { SITE_URL } from './site'
import type { OrgSummary } from './types'

/** Where the sessions are served. Keep in step with netlify/lib/auth-proxy.mjs. */
const AUTH_PATH = '/api/auth'

/** The session of a sign-in that isn't tied to an organization yet. */
export const NEW_SLOT = '_new'

/** Paths of the app that aren't an organization. */
const APP_PAGES = new Set(['', 'login', 'signup', 'open', 'new', 'organizations', 'file'])

const ORG_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

/** The organization in a path of this app ("/acme/team" → "acme"), if any. */
export function orgOfPath(path: string): string | null {
  const first = path.split(/[/?#]/)[1] ?? ''
  return !APP_PAGES.has(first) && first.length >= 2 && ORG_SLUG.test(first) ? first : null
}

export interface Account {
  userId: string
  email: string
  name: string
  /** The organizations this browser keeps the account's session for. */
  slots: string[]
  /** Its organizations, as last seen. */
  orgs: Pick<OrgSummary, 'slug' | 'name'>[]
  /** The organizations it was signed out of on this browser: their sessions aren't kept again until it signs in afresh. */
  left?: string[]
}

interface Saved {
  accounts: Account[]
  /** The session used last, for the pages outside an organization. */
  last?: string
}

const STORE = 'teamshelf.accounts'

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null
    if (saved && Array.isArray(saved.accounts)) return saved
  } catch {
    // Storage blocked or unreadable: start with an empty list.
  }
  return { accounts: [] }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(saved))
  } catch {
    // Only the menus lose track; the sessions stay.
  }
}

/** The session this page uses, chosen once when it loads. */
export const ACTIVE_SLOT: string = (() => {
  // On the server (pages drawn at build time) there is no session to choose.
  if (typeof window === 'undefined') return NEW_SLOT
  const { pathname } = window.location
  // Signing in (or giving the email for a new organization) starts a new session.
  if (/^\/(login|signup)(\/|$)/.test(pathname)) return NEW_SLOT
  const org = orgOfPath(pathname)
  if (org) {
    save({ ...load(), last: org })
    return org
  }
  return load().last ?? NEW_SLOT
})()

/** The address of Neon Auth for this page: its session's path on this site. */
// On the server (pages drawn at build time) it is the public site's, so the client can be made;
// nothing is signed in there.
export const authUrl = (slot = ACTIVE_SLOT) => `${typeof window === 'undefined' ? SITE_URL : window.location.origin}${AUTH_PATH}/${slot}`

export const savedAccounts = (): Account[] => load().accounts

/** Makes this session the one the pages outside an organization use. */
export const setLastSlot = (slot: string) => save({ ...load(), last: slot })

async function post(slot: string, action: string, slots: string[]) {
  const response = await fetch(`${authUrl(slot)}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slots }),
  })
  if (!response.ok) throw new Error('The session could not be kept for every organization.')
}

/**
 * Records an account and its organizations, and keeps its session (taken from `from`) for each
 * of them. An organization another account already holds stays with that account, unless
 * `takeOver` (a fresh sign-in takes its organizations for itself).
 */
export async function rememberAccount(from: string, user: { id: string; email: string; name?: string | null }, orgs: Pick<OrgSummary, 'slug' | 'name'>[], takeOver = false) {
  const saved = load()
  const others = saved.accounts.filter((account) => account.userId !== user.id)
  const mine = saved.accounts.find((account) => account.userId === user.id)
  // The session it comes from is this account's, whatever the list says.
  const heldByOthers = new Set(takeOver ? [] : others.flatMap((account) => account.slots).filter((slot) => slot !== from))
  // A fresh sign-in comes back to the organizations it was signed out of.
  const left = takeOver ? [] : (mine?.left ?? [])
  const slots = orgs.map((org) => org.slug).filter((slug) => !heldByOthers.has(slug) && !left.includes(slug))
  const missing = slots.filter((slug) => slug !== from && !mine?.slots.includes(slug))
  if (missing.length) await post(from, '~copy', missing)

  const taken = new Set(slots)
  const account: Account = { userId: user.id, email: user.email, name: user.name ?? '', slots, orgs, left }
  save({ ...saved, accounts: [...others.map((other) => ({ ...other, slots: other.slots.filter((slot) => !taken.has(slot)) })), account] })
  return account
}

/** Drops an account from this browser's list, without touching any session. */
export function dropAccount(userId: string) {
  const saved = load()
  save({ ...saved, accounts: saved.accounts.filter((account) => account.userId !== userId) })
}

/** Clears the session a sign-in started with, once it is kept for the account's organizations. */
export const forgetNewSession = () => post(NEW_SLOT, '~forget', [NEW_SLOT]).catch(() => {})

/** Signs an account out (ending its session at Neon Auth) and forgets it in this browser. */
export async function signOutAccount(account: Pick<Account, 'userId' | 'slots'>, alsoSlot?: string) {
  const slots = [...new Set([...(alsoSlot ? [alsoSlot] : []), ...account.slots])]
  if (!slots.length) return
  await fetch(`${authUrl(slots[0])}/sign-out`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
  await post(slots[0], '~forget', slots).catch(() => {})
  const saved = load()
  const accounts = saved.accounts.filter((one) => one.userId !== account.userId)
  save({ ...saved, accounts, last: accounts[0]?.slots[0] })
}

/**
 * Signs this browser out of one organization. The account's other organizations stay signed in,
 * so its session only ends at Neon Auth when this was the last of them.
 */
export async function signOutOrg(slot: string, userId: string | undefined) {
  const saved = load()
  const account = saved.accounts.find((one) => one.userId === userId)
  const remaining = account?.slots.filter((one) => one !== slot) ?? []
  if (remaining.length === 0) await fetch(`${authUrl(slot)}/sign-out`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
  await post(slot, '~forget', [slot]).catch(() => {})
  const accounts = saved.accounts
    .map((one) => (one.userId === userId ? { ...one, slots: remaining, left: [...new Set([...(one.left ?? []), slot])] } : one))
    .filter((one) => one.slots.length > 0)
  save({ ...saved, accounts, last: remaining[0] ?? accounts.find((one) => one.slots.length > 0)?.slots[0] })
}

/**
 * After an organization's address changed: keeps this browser's session for it at the new
 * address, forgets the old one, and renames it in the list of accounts.
 */
export async function moveOrgSession(from: string, to: string) {
  await post(from, '~copy', [to])
  await post(from, '~forget', [from]).catch(() => {})
  const saved = load()
  const rename = (slug: string) => (slug === from ? to : slug)
  save({
    accounts: saved.accounts.map((account) => ({ ...account, slots: account.slots.map(rename), orgs: account.orgs.map((org) => ({ ...org, slug: rename(org.slug) })) })),
    last: saved.last === from ? to : saved.last,
  })
}

/** Signs this browser out of every organization, and of the session this page uses. */
export async function signOutEverywhere(alsoSlot: string) {
  for (const account of load().accounts) await signOutAccount(account)
  await signOutAccount({ userId: '', slots: [alsoSlot] })
  await forgetNewSession()
  save({ accounts: [] })
}

/** Where to go after signing out: the organizations still signed in, or signing in. */
export const pathAfterSignOut = () => (load().accounts.some((account) => account.slots.length > 0) ? '/organizations' : '/login')

/** The organizations this browser keeps a session for with this email, if any. */
export const slotsOfEmail = (email: string) => load().accounts.find((account) => account.email.toLowerCase() === email.trim().toLowerCase())?.slots ?? []

/**
 * Opens a path with the session it needs, by loading the page again. For another account's
 * organization, or signing in. Within this page's account, the app's own navigation is enough.
 */
export function crossTo(path: string) {
  window.location.assign(path)
}

/** What another signed-in account sees now: its organizations, from its own session. Null if signed out; throws if it can't tell. */
export async function fetchAccount(slot: string): Promise<{ user: { id: string; email: string; name: string }; orgs: Pick<OrgSummary, 'slug' | 'name'>[] } | null> {
  const response = await fetch(`${authUrl(slot)}/get-session`)
  if (!response.ok) throw new Error('Could not reach the sign-in service.')
  const session = (await response.json()) as { user?: { id: string; email: string; name: string } } | null
  if (!session?.user) return null
  const token = response.headers.get('set-auth-jwt') ?? (await fetch(`${authUrl(slot)}/token`).then((reply) => (reply.ok ? reply.json() : null)))?.token
  if (!token) throw new Error('Could not get a token for another account.')
  const answer = await fetch(`${import.meta.env.VITE_NEON_DATA_API_URL}/rpc/my_orgs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: '{}',
  })
  const mine = answer.ok ? ((await answer.json()) as { ready?: boolean; orgs?: OrgSummary[] }) : null
  if (!mine?.ready) throw new Error('Could not load the organizations of another account.')
  return { user: session.user, orgs: (mine.orgs ?? []).map(({ slug, name }) => ({ slug, name })) }
}
