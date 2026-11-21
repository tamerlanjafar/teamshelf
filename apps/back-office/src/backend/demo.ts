// Demo mode (`pnpm dev:demo`): made-up numbers and no sign-in, to look at the screens and to test
// them. Who is "signed in" is chosen in the address: ?as=guest (nobody), ?as=member (someone who
// isn't a super admin), anything else: a super admin. It is remembered for the tab.

import type { Day, OrgRow, ReportAnswer, Session } from '@/report'

const MB = 1024 ** 2

function who(): string {
  const chosen = new URLSearchParams(window.location.search).get('as')
  if (chosen) sessionStorage.setItem('demo-as', chosen)
  return chosen ?? sessionStorage.getItem('demo-as') ?? 'admin'
}

export function useSession(): Session {
  return who() === 'guest' ? { state: 'signed-out' } : { state: 'signed-in', email: who() === 'member' ? 'sam@example.com' : 'admin@example.com' }
}

export async function sendSignInLink(email: string) {
  if (email.includes('fail')) throw new Error('The email could not be sent.')
}

export async function signOut() {
  sessionStorage.setItem('demo-as', 'guest')
  window.location.assign('/')
}

const daysAgo = (days: number) => new Date(Date.UTC(2026, 10, 21) - days * 86_400_000).toISOString()

const org = (name: string, people: number, spaces: number, links: number, files: number, megabytes: number, created: number, active: number, extra: Partial<OrgRow> = {}): OrgRow => ({
  id: name.toLowerCase(),
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  owner: `owner@${name.toLowerCase().replace(/\s+/g, '')}.example.com`,
  people,
  invited: 0,
  spaces,
  links,
  files,
  waiting: 0,
  file_bytes: megabytes * MB,
  created_at: daysAgo(created),
  last_active: daysAgo(active),
  ...extra,
})

const ORGS = [
  org('Acme', 42, 6, 310, 38, 986, 120, 0, { invited: 3, waiting: 4 }),
  org('Lumen Labs', 18, 4, 142, 21, 412, 64, 1, { waiting: 1 }),
  org('Orbit', 9, 3, 77, 6, 58, 30, 2, { invited: 2 }),
  org('Northwind', 5, 2, 31, 2, 9, 12, 6),
  org('Fern', 1, 0, 0, 0, 0, 2, 2),
]

// A quiet month with a busier last week, the same every time.
const DAYS: Day[] = Array.from({ length: 30 }, (_, index) => ({
  day: daysAgo(29 - index).slice(0, 10),
  orgs: [26, 17, 1].includes(index) ? 1 : 0,
  people: [0, 2, 1, 0, 0, 3, 1, 0, 2, 0, 0, 1, 4, 0, 0, 2, 1, 0, 0, 3, 5, 2, 0, 0, 1, 6, 4, 2, 3, 1][index],
  links: [4, 9, 6, 0, 0, 12, 8, 5, 11, 7, 0, 0, 14, 9, 6, 10, 13, 0, 0, 16, 21, 12, 9, 15, 0, 0, 24, 18, 20, 11][index],
}))

const sum = (pick: (row: OrgRow) => number) => ORGS.reduce((total, row) => total + pick(row), 0)

export async function fetchReport(): Promise<ReportAnswer> {
  if (who() === 'member') return { ready: true, allowed: false }
  return {
    ready: true,
    allowed: true,
    generated_at: daysAgo(0),
    totals: {
      orgs: ORGS.length,
      people: sum((row) => row.people),
      invited: sum((row) => row.invited),
      spaces: sum((row) => row.spaces),
      links: sum((row) => row.links),
      files: sum((row) => row.files),
      waiting: sum((row) => row.waiting),
      file_bytes: sum((row) => row.file_bytes),
      orgs_30d: 3,
      people_30d: DAYS.reduce((total, one) => total + one.people, 0),
      links_30d: DAYS.reduce((total, one) => total + one.links, 0),
    },
    days: DAYS,
    orgs: ORGS,
    spaces: [
      { org: 'Acme', space: 'Design', files: 14, file_bytes: 244 * MB },
      { org: 'Acme', space: 'Development', files: 11, file_bytes: 201 * MB },
      { org: 'Lumen Labs', space: 'Research', files: 12, file_bytes: 188 * MB },
      { org: 'Acme', space: 'Data', files: 9, file_bytes: 96 * MB },
      { org: 'Orbit', space: 'Engineering', files: 6, file_bytes: 58 * MB },
    ],
  }
}
