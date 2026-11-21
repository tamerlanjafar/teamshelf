// What the back office shows, as the database gives it (public.back_office_report, db/migrations).

export interface Totals {
  orgs: number
  people: number
  invited: number
  spaces: number
  links: number
  files: number
  /** Suggestions waiting for review. */
  waiting: number
  file_bytes: number
  orgs_30d: number
  people_30d: number
  links_30d: number
}

/** What happened on one day. */
export interface Day {
  day: string
  orgs: number
  people: number
  links: number
}

export interface OrgRow {
  id: string
  slug: string
  name: string
  created_at: string
  /** The email that created it. */
  owner: string | null
  people: number
  invited: number
  spaces: number
  links: number
  files: number
  waiting: number
  file_bytes: number
  last_active: string
}

export interface SpaceRow {
  org: string
  space: string
  files: number
  file_bytes: number
}

export interface Report {
  generated_at: string
  totals: Totals
  /** The last 30 days, oldest first. */
  days: Day[]
  orgs: OrgRow[]
  /** The spaces that hold the most files, largest first. */
  spaces: SpaceRow[]
}

/** The database's answer: not ready yet (just signed in), not allowed, or the report. */
export type ReportAnswer = { ready: false } | { ready: true; allowed: false } | ({ ready: true; allowed: true } & Report)

/** How much an organization and a space may hold (db/migrations/008_file_storage_limits.sql). */
export const ORG_LIMIT = 1024 ** 3
export const SPACE_LIMIT = 250 * 1024 ** 2

/** Who is signed in to the back office, if anyone. */
export type Session = { state: 'loading' } | { state: 'signed-out' } | { state: 'signed-in'; email: string }
