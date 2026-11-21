// What the Neon Data API and the database functions do, done on the mock's tables. Only as much
// as the app asks for. Access rules are a light imitation of db/migrations: enough for each role
// to see what it would, not a test of the real rules.

import type { Member, Org, Space } from '@/lib/types'
import { getState, now, update, uuid, type Tables, type User } from './store'

export interface Answer {
  data: unknown
  error: { message: string; code?: string } | null
}

const ok = (data: unknown): Answer => ({ data, error: null })
const fail = (message: string, code?: string): Answer => ({ data: null, error: { message, code } })

type Row = Record<string, unknown>
type TableName = Exclude<keyof Tables, 'users' | 'org_creators'>

export interface Filter {
  column: string
  op: 'eq' | 'neq'
  value: unknown
}

export interface Query {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  values?: Row | Row[]
  filters: Filter[]
  order?: { column: string; ascending: boolean }
  /** Only these columns come back (a select list). Null: all of them. */
  columns: string[] | null
  returning: boolean
  single: 'one' | 'maybe' | null
}

// ---- Who is asking -------------------------------------------------------------------------

function memberOf(db: Tables, user: User | null, orgId: unknown): Member | undefined {
  return user ? db.members.find((one) => one.org_id === orgId && one.user_id === user.id) : undefined
}

function spaceRole(db: Tables, member: Member | undefined, spaceId: unknown) {
  if (!member) return null
  return db.space_members.find((row) => row.space_id === spaceId && row.member_id === member.id)?.role ?? null
}

function seesSpace(db: Tables, user: User | null, space: Space) {
  const member = memberOf(db, user, space.org_id)
  return Boolean(member) && (space.visibility === 'org' || spaceRole(db, member, space.id) !== null)
}

/** The rows of a table this user may read, as row-level security would leave them. */
function visibleRows(db: Tables, user: User | null, table: TableName): Row[] {
  const rows = db[table] as unknown as Row[]
  switch (table) {
    case 'spaces':
      return (rows as unknown as Space[]).filter((space) => seesSpace(db, user, space)) as unknown as Row[]
    case 'links':
      return db.links.filter((link) => {
        const space = db.spaces.find((one) => one.id === link.space_id)
        if (!space || !seesSpace(db, user, space)) return false
        const member = memberOf(db, user, link.org_id)
        const admin = spaceRole(db, member, link.space_id) === 'admin'
        if (link.status !== 'approved') return admin || link.created_by === member?.id
        if (link.visibility === 'everyone' || admin) return true
        if (link.visibility === 'members') return db.link_access.some((row) => row.link_id === link.id && row.member_id === member?.id)
        return false
      }) as unknown as Row[]
    default:
      return rows
  }
}

// ---- Tables --------------------------------------------------------------------------------

/** Columns a new row gets when the insert leaves them out. */
function withDefaults(db: Tables, user: User | null, table: TableName, values: Row): Row {
  const id = uuid()
  switch (table) {
    case 'links':
      return {
        id,
        kind: 'link',
        group_id: null,
        proposed_group: null,
        icon_url: null,
        file_key: null,
        file_name: null,
        file_size: null,
        file_type: null,
        status: 'pending',
        visibility: 'everyone',
        position: null,
        created_by: memberOf(db, user, values.org_id)?.id ?? null,
        created_at: now(),
        reviewed_at: null,
        review_note: '',
        url: '',
        ...values,
      }
    case 'groups':
      return { id, position: null, created_at: now(), ...values }
    case 'members':
      return { id, name: '', user_id: null, invited_by: memberOf(db, user, values.org_id)?.id ?? null, invited_at: now(), joined_at: null, role: 'member', approved: true, ...values }
    default:
      return { ...values }
  }
}

/** The unique keys the database has, as [columns, message]. */
const UNIQUE: Partial<Record<TableName, [string[], string][]>> = {
  members: [[['org_id', 'email'], 'That person is already in the organization.']],
  groups: [[['space_id', 'name'], 'That group already exists.']],
  spaces: [[['org_id', 'slug'], 'That space already exists.']],
}

function duplicate(db: Tables, table: TableName, row: Row, except?: Row) {
  const rows = db[table] as unknown as Row[]
  for (const [columns, message] of UNIQUE[table] ?? []) {
    const same = (other: Row) => other !== except && columns.every((column) => String(other[column]).toLowerCase() === String(row[column]).toLowerCase())
    if (rows.some(same)) return message
  }
  if (table === 'links' && row.status === 'approved' && row.group_id) {
    const clash = db.links.find((other) => (other as unknown as Row) !== except && other.status === 'approved' && other.group_id === row.group_id && other.title.toLowerCase() === String(row.title).toLowerCase())
    if (clash) return 'That link already exists.'
  }
  return null
}

/** A column of a row, or of a row it points to ("spaces.org_id" on space_members). */
function valueOf(db: Tables, row: Row, column: string) {
  const [related, field] = column.split('.')
  if (!field) return row[column]
  const target = (db[related as TableName] as unknown as Row[] | undefined)?.find((other) => other.id === row[`${related.replace(/s$/, '')}_id`])
  return target?.[field]
}

const matches = (db: Tables, row: Row, filters: Filter[]) =>
  filters.every(({ column, op, value }) => (op === 'eq' ? valueOf(db, row, column) === value : valueOf(db, row, column) !== value))

function pick(row: Row, columns: string[] | null) {
  if (!columns) return { ...row }
  return Object.fromEntries(columns.filter((column) => !column.includes('(')).map((column) => [column, row[column]]))
}

function shape(rows: Row[], query: Query): Answer {
  const picked = rows.map((row) => pick(row, query.columns))
  if (query.single === 'one') return picked.length === 1 ? ok(picked[0]) : fail('Expected one row.', 'PGRST116')
  if (query.single === 'maybe') return ok(picked[0] ?? null)
  return ok(query.action === 'select' || query.returning ? picked : null)
}

/** Runs a Data API request as `user`. */
export function runQuery(query: Query, user: User | null): Answer {
  const table = query.table as TableName
  if (!(table in getState().db)) return fail(`No table ${query.table}.`)
  if (!user) return fail('Not signed in.', '42501')

  if (query.action === 'select') {
    const db = getState().db
    let rows = visibleRows(db, user, table).filter((row) => matches(db, row, query.filters))
    if (query.order) {
      const { column, ascending } = query.order
      rows = [...rows].sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? '')) * (ascending ? 1 : -1))
    }
    return shape(rows, query)
  }

  let answer: Answer = ok(null)
  update(({ db }) => {
    const rows = db[table] as unknown as Row[]
    if (query.action === 'insert' || query.action === 'upsert') {
      const list = Array.isArray(query.values) ? query.values : [query.values ?? {}]
      const created: Row[] = []
      for (const values of list) {
        if (query.action === 'upsert' && table === 'member_prefs') {
          const existing = rows.find((row) => row.member_id === values.member_id)
          if (existing) {
            Object.assign(existing, values)
            created.push(existing)
            continue
          }
        }
        const row = withDefaults(db, user, table, values)
        const problem = duplicate(db, table, row)
        if (problem) {
          answer = fail(problem, '23505')
          return
        }
        rows.push(row)
        created.push(row)
      }
      answer = shape(created, query)
      return
    }

    // The rows themselves (not copies), so changing them changes the table.
    const targets = visibleRows(db, user, table).filter((row) => matches(db, row, query.filters))
    const lastAdmin = keepsAdmins(db, table, targets, query.action === 'update' ? (query.values as Row) : null)
    if (lastAdmin) {
      answer = fail(lastAdmin, 'P0001')
      return
    }
    if (query.action === 'update') {
      // As the trigger only_admins_open_spaces: opening a space to everyone is for admins of the organization.
      const values = query.values as Row
      if (table === 'spaces' && values.visibility === 'org' && targets.some((row) => row.visibility !== 'org' && memberOf(db, user, row.org_id)?.role !== 'admin')) {
        answer = fail('Only admins of the organization can open a space to everyone in it.', '42501')
        return
      }
      for (const row of targets) {
        // An organization's address is unique.
        if (table === 'orgs' && typeof values.slug === 'string' && values.slug !== row.slug && db.orgs.some((org) => org.slug === values.slug)) {
          answer = fail('That URL is taken.', '23505')
          return
        }
        const problem = duplicate(db, table, { ...row, ...(query.values as Row) }, row)
        if (problem) {
          answer = fail(problem, '23505')
          return
        }
        Object.assign(row, query.values)
      }
      answer = shape(targets, query)
      return
    }

    // delete, and what goes with it
    const gone = new Set(targets)
    ;(db as unknown as Record<string, Row[]>)[table] = rows.filter((row) => !gone.has(row))
    const ids = new Set(targets.map((row) => row.id))
    if (table === 'spaces') {
      db.groups = db.groups.filter((one) => !ids.has(one.space_id))
      db.links = db.links.filter((one) => !ids.has(one.space_id))
      db.space_members = db.space_members.filter((one) => !ids.has(one.space_id))
    }
    if (table === 'groups') db.links = db.links.filter((one) => !ids.has(one.group_id ?? ''))
    if (table === 'members') db.space_members = db.space_members.filter((one) => !ids.has(one.member_id))
    answer = shape(targets, query)
  })
  return answer
}

/**
 * As the database's triggers (keep_an_org_admin, keep_a_space_admin): an organization keeps an
 * admin who has signed in, and a space keeps an admin, also when someone leaves the organization.
 */
function keepsAdmins(db: Tables, table: TableName, targets: Row[], changes: Row | null): string | null {
  const demotes = (row: Row) => row.role === 'admin' && (changes === null || ('role' in changes && changes.role !== 'admin'))
  if (table === 'members') {
    for (const row of targets.filter(demotes)) {
      if (!row.user_id) continue
      const others = db.members.filter((one) => one.org_id === row.org_id && one.role === 'admin' && one.user_id && !targets.includes(one as unknown as Row))
      if (others.length === 0) return 'An organization needs an admin. Make someone else an admin first.'
    }
  }
  const leaving: { space_id: string; member_id: string }[] =
    table === 'space_members'
      ? (targets.filter(demotes) as unknown as { space_id: string; member_id: string }[])
      : table === 'members' && changes === null
        ? db.space_members.filter((row) => row.role === 'admin' && targets.some((one) => one.id === row.member_id))
        : []
  for (const row of leaving) {
    const others = db.space_members.filter((one) => one.space_id === row.space_id && one.role === 'admin' && !leaving.some((gone) => gone.space_id === one.space_id && gone.member_id === one.member_id))
    if (others.length === 0) return `A space needs an admin. Make someone else an admin of ${db.spaces.find((space) => space.id === row.space_id)?.name ?? 'it'} first.`
  }
  return null
}

// ---- Database functions --------------------------------------------------------------------

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? ''

/** Turns the invitations sent to this email into memberships, as my_orgs does. */
function acceptInvitations(user: User) {
  const waiting = getState().db.members.some((one) => one.user_id === null && one.approved && one.email.toLowerCase() === user.email.toLowerCase())
  if (!waiting)
    return
  update(({ db }) => {
    for (const one of db.members)
      if (one.user_id === null && one.approved && one.email.toLowerCase() === user.email.toLowerCase()) {
        one.user_id = user.id
        one.joined_at = now()
        if (!one.name) one.name = user.name
      }
  })
}

const summary = (org: Org, role?: Member['role']) => ({ id: org.id, slug: org.slug, name: org.name, ...(role ? { role } : {}) })

function joinable(db: Tables, user: User) {
  return db.orgs.filter((org) => org.allowed_domains.includes(domainOf(user.email)) && !db.members.some((one) => one.org_id === org.id && one.email.toLowerCase() === user.email.toLowerCase()))
}

export function myOrgs(user: User) {
  acceptInvitations(user)
  const { db } = getState()
  const mine = db.members.filter((one) => one.user_id === user.id)
  return {
    ready: true,
    orgs: mine.map((one) => summary(db.orgs.find((org) => org.id === one.org_id)!, one.role)).filter((org) => org.id),
    joinable: joinable(db, user).map((org) => summary(org)),
    can_create: db.org_creators.includes(user.email.toLowerCase()),
  }
}

type Args = Record<string, unknown>

function positions<T extends { id: string; position: number | null }>(rows: T[], ids: string[]) {
  for (const row of rows) if (ids.includes(row.id)) row.position = ids.indexOf(row.id) + 1
}

export function runRpc(name: string, args: Args, user: User | null): Answer {
  if (!user) return fail('Not signed in.', '42501')
  switch (name) {
    case 'my_orgs':
      return ok(myOrgs(user))

    case 'open_org': {
      acceptInvitations(user)
      const { db } = getState()
      const org = db.orgs.find((one) => one.slug === args.org_slug)
      const member = org && memberOf(db, user, org.id)
      if (org && member) return ok({ ready: true, access: { org, member, can_join: false } })
      if (org && joinable(db, user).includes(org)) return ok({ ready: true, access: { org: { slug: org.slug, name: org.name }, member: null, can_join: true } })
      return ok({ ready: true, access: null })
    }

    case 'join_org': {
      const { db } = getState()
      const org = db.orgs.find((one) => one.slug === args.org_slug)
      if (!org || !joinable(db, user).includes(org)) return fail("You can't join this organization.", '42501')
      // An invitation still waiting for approval is taken up too.
      const waiting = db.members.find((one) => one.org_id === org.id && one.email === user.email && one.user_id === null)
      const member: Member = waiting
        ? { ...waiting, user_id: user.id, joined_at: now(), approved: true }
        : { id: uuid(), org_id: org.id, email: user.email, name: user.name, role: 'member', user_id: user.id, invited_by: null, invited_at: now(), joined_at: now(), approved: true }
      update(({ db: draft }) => {
        draft.members = [...draft.members.filter((one) => one.id !== member.id), member]
      })
      return ok(member)
    }

    case 'create_org': {
      const { db } = getState()
      if (!db.org_creators.includes(user.email.toLowerCase())) return fail("This account can't create organizations.", '42501')
      if (db.orgs.some((one) => one.slug === args.org_slug)) return fail('duplicate key', '23505')
      const org: Org = { id: uuid(), slug: String(args.org_slug), name: String(args.org_name).trim(), allowed_domains: [] }
      update(({ db: draft }) => {
        draft.orgs.push(org)
        draft.members.push({ id: uuid(), org_id: org.id, email: user.email, name: user.name, role: 'admin', user_id: user.id, invited_by: null, invited_at: now(), joined_at: now(), approved: true })
      })
      return ok(org)
    }

    case 'create_space': {
      const { db } = getState()
      const member = memberOf(db, user, args.org)
      if (!member) return fail('Only people in the organization can create spaces.', '42501')
      if (db.spaces.some((one) => one.org_id === args.org && one.slug === args.space_slug)) return fail('That space already exists.', '23505')
      const created: Space = {
        id: uuid(),
        org_id: String(args.org),
        slug: String(args.space_slug),
        name: String(args.space_name),
        logo: String(args.space_logo),
        color: args.space_color as Space['color'],
        // Only admins of the organization start spaces everyone sees.
        visibility: member.role === 'admin' ? 'org' : 'private',
        layout: [],
        card_sizes: {},
        position: null,
        created_at: now(),
      }
      update(({ db: draft }) => {
        draft.spaces.push(created)
        draft.space_members.push({ space_id: created.id, member_id: member.id, role: 'admin' })
      })
      return ok(created)
    }

    case 'invite_to_space': {
      const { db } = getState()
      const space = db.spaces.find((one) => one.id === args.space)
      const inviter = space && memberOf(db, user, space.org_id)
      if (!space || !inviter || spaceRole(db, inviter, space.id) !== 'admin') return fail("Only the space's admins can invite people to it.", '42501')
      const org = db.orgs.find((one) => one.id === space.org_id)!
      const address = String(args.invitee_email).trim().toLowerCase()
      const role = args.invitee_role === 'admin' ? 'admin' : 'member'
      let member = db.members.find((one) => one.org_id === org.id && one.email === address)
      update(({ db: draft }) => {
        if (!member) {
          member = {
            id: uuid(),
            org_id: org.id,
            email: address,
            name: '',
            role: 'member',
            user_id: null,
            invited_by: inviter.id,
            invited_at: now(),
            joined_at: null,
            approved: inviter.role === 'admin' || org.allowed_domains.includes(domainOf(address)),
          }
          draft.members.push(member)
        } else if (!member.approved && inviter.role === 'admin') {
          member = { ...member, approved: true }
          draft.members = draft.members.map((one) => (one.id === member!.id ? member! : one))
        }
        const existing = draft.space_members.find((row) => row.space_id === space.id && row.member_id === member!.id)
        if (existing) existing.role = role
        else draft.space_members.push({ space_id: space.id, member_id: member.id, role })
      })
      return ok(member!.user_id ? 'added' : member!.approved ? 'invited' : 'waiting')
    }

    case 'set_group_order':
      update(({ db }) => positions(db.groups.filter((one) => one.space_id === args.space), args.ids as string[]))
      return ok(null)
    case 'set_link_order':
      update(({ db }) => positions(db.links.filter((one) => one.group_id === args.group_id), args.ids as string[]))
      return ok(null)
    case 'set_space_order':
      update(({ db }) => positions(db.spaces.filter((one) => one.org_id === args.org), args.ids as string[]))
      return ok(null)

    default:
      return fail(`No function ${name} in mock mode.`)
  }
}
