// Example data for mock mode, and the situations ("scenarios") the screens need.
// Everything here is made up. Ids are readable so addresses and rows are easy to follow.

import { NO_PREFS, type Color, type Folder, type Group, type Link, type Member, type Role, type Space } from '@/lib/types'
import { setState, type MockState, type Tables } from './store'

const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const USERS = {
  alex: { id: 'user-alex', email: 'alex@acme.com', name: 'Alex Morgan' },
  alexLumen: { id: 'user-alex-lumen', email: 'alex.morgan@lumenlabs.dev', name: 'Alex Morgan' },
  newcomer: { id: 'user-newcomer', email: 'sam.rivera@gmail.com', name: '' },
  sam: { id: 'user-sam', email: 'sam@acme.com', name: 'Sam Lee' },
  priya: { id: 'user-priya', email: 'priya@acme.com', name: 'Priya Nair' },
  mina: { id: 'user-mina', email: 'mina@acme.com', name: 'Mina Park' },
}

function member(id: string, org_id: string, email: string, name: string, role: Role, user_id: string | null, daysAgo: number, extra: Partial<Member> = {}): Member {
  return { id, org_id, email, name, role, user_id, invited_by: null, invited_at: day(daysAgo), joined_at: user_id ? day(daysAgo - 1) : null, approved: true, ...extra }
}

function space(id: string, org_id: string, slug: string, name: string, logo: string, color: Color, position: number, visibility: Space['visibility'] = 'org'): Space {
  return { id, org_id, slug, name, logo, color, visibility, layout: [], card_sizes: {}, position, created_at: day(90) }
}

function group(id: string, org_id: string, space_id: string, name: string, color: Color, position: number): Group {
  return { id, org_id, space_id, name, color, position, created_at: day(80) }
}

let linkCount = 0
function link(org_id: string, space_id: string, group_id: string | null, title: string, url: string, extra: Partial<Link> = {}): Link {
  linkCount += 1
  return {
    id: `link-${linkCount}`,
    org_id,
    space_id,
    kind: 'link',
    group_id,
    proposed_group: null,
    folder_id: null,
    title,
    url,
    icon_url: null,
    file_key: null,
    file_name: null,
    file_size: null,
    file_type: null,
    status: 'approved',
    visibility: 'everyone',
    position: linkCount,
    created_by: 'm-nw-alex',
    created_at: day(60 - linkCount),
    reviewed_at: day(59 - linkCount),
    review_note: '',
    ...extra,
  }
}

function folder(id: string, group_id: string, parent_id: string | null, name: string): Folder {
  return { id, org_id: 'org-acme', space_id: 'space-nw-data', group_id, parent_id, name, created_at: day(70) }
}

/** A document of the Data team's, kept in Documentation (in a folder, or at its top). */
function dataDoc(title: string, fileName: string, folder_id: string | null, extra: Partial<Link> = {}): Link {
  const type = fileName.endsWith('.pdf') ? 'application/pdf' : 'text/markdown'
  const key = `mock/data/${fileName}`
  return link('org-acme', 'space-nw-data', 'g-data-docs', title, `/file?key=${key}`, { kind: 'file', file_key: key, file_name: fileName, file_size: 18_000 + title.length * 900, file_type: type, folder_id, ...extra })
}

/**
 * The Data team's documentation: one group, its files arranged in folders inside folders.
 * "Archive" is empty: only the space's admins see it.
 */
const DATA_FOLDERS: Folder[] = [
  folder('f-pipelines', 'g-data-docs', null, 'Pipelines'),
  folder('f-warehouse', 'g-data-docs', 'f-pipelines', 'Warehouse'),
  folder('f-transform', 'g-data-docs', 'f-pipelines', 'Transform'),
  folder('f-metrics', 'g-data-docs', null, 'Metrics'),
  folder('f-finance', 'g-data-docs', 'f-metrics', 'Finance'),
  folder('f-onboarding', 'g-data-docs', null, 'Onboarding'),
  folder('f-runbooks', 'g-data-docs', null, 'Runbooks'),
  folder('f-archive', 'g-data-docs', null, 'Archive'),
]

/** Acme (the main organization), Lumen Labs (Alex's other email), Orbit (open to @lumenlabs.dev). */
function world(): Tables {
  linkCount = 0
  const nw = 'org-acme'
  const lumen = 'org-lumen'
  const dev = 'space-nw-dev'
  const design = 'space-nw-design'
  const data = 'space-nw-data'
  const leads = 'space-nw-leads'

  const links: Link[] = [
    link(nw, dev, 'g-online', 'Customer portal', 'https://portal.example.com'),
    link(nw, dev, 'g-online', 'Partner portal', 'https://partners.example.com'),
    link(nw, dev, 'g-online', 'Public API', 'https://api.example.com'),
    link(nw, dev, 'g-online', 'Payments API (v2)', 'https://payments.example.com'),
    link(nw, dev, 'g-online', 'Mobile app', 'https://app.example.com'),
    link(nw, dev, 'g-online', 'Admin console', 'https://admin.example.com', { visibility: 'admins' }),
    link(nw, dev, 'g-monitoring', 'Grafana', 'https://grafana.com'),
    link(nw, dev, 'g-monitoring', 'Uptime Kuma', 'https://uptime.kuma.pet'),
    link(nw, dev, 'g-monitoring', 'Sentry', 'https://sentry.io'),
    link(nw, dev, 'g-monitoring', 'Status page', 'https://www.atlassian.com/software/statuspage'),
    link(nw, dev, 'g-cicd', 'GitHub Actions', 'https://github.com/features/actions'),
    link(nw, dev, 'g-cicd', 'Netlify', 'https://www.netlify.com'),
    link(nw, dev, 'g-cicd', 'Vercel', 'https://vercel.com'),
    link(nw, dev, 'g-cicd', 'Docker Hub', 'https://hub.docker.com'),
    link(nw, dev, 'g-docs', 'Architecture', '/file?key=mock/architecture.pdf', { kind: 'file', file_key: 'mock/architecture.pdf', file_name: 'architecture.pdf', file_size: 2_400_000, file_type: 'application/pdf' }),
    link(nw, dev, 'g-docs', 'Onboarding guide', 'https://www.notion.so'),
    link(nw, dev, 'g-docs', 'API reference', 'https://swagger.io'),
    link(nw, design, 'g-figma', 'Product', 'https://www.figma.com'),
    link(nw, design, 'g-figma', 'Design system', 'https://www.figma.com'),
    link(nw, design, 'g-assets', 'Storybook', 'https://storybook.js.org'),
    link(nw, design, 'g-assets', 'Icon library', 'https://lucide.dev'),
    link(nw, design, 'g-assets', 'Mobbin', 'https://mobbin.com'),
    link(nw, data, 'g-dash', 'Metabase', 'https://www.metabase.com'),
    link(nw, data, 'g-dash', 'Mixpanel', 'https://mixpanel.com'),
    link(nw, leads, 'g-plans', 'Roadmap', 'https://www.notion.so'),
    // Waiting for review, and one that was turned down.
    link(nw, dev, 'g-cicd', 'Jira board', 'https://www.atlassian.com/software/jira', { status: 'pending', created_by: 'm-nw-priya', reviewed_at: null, created_at: day(1) }),
    link(nw, dev, null, 'Postman', 'https://www.postman.com', { status: 'pending', proposed_group: 'Tools', created_by: 'm-nw-mina', reviewed_at: null, created_at: day(2) }),
    link(nw, design, 'g-assets', 'Brand kit', 'https://brand.example.com', { status: 'pending', created_by: 'm-nw-alex', reviewed_at: null, created_at: day(3) }),
    link(nw, data, 'g-dash', 'Old dashboards', 'https://old.example.com', { status: 'rejected', created_by: 'm-nw-alex', review_note: 'We moved everything to Metabase.', created_at: day(9) }),
    link(lumen, 'space-lumen-research', 'g-lumen-papers', 'Paper drafts', 'https://www.overleaf.com'),
    link(lumen, 'space-lumen-research', 'g-lumen-papers', 'Lab wiki', 'https://www.notion.so'),
    link('org-orbit', 'space-orbit-eng', 'g-orbit-tools', 'Issue tracker', 'https://linear.app', { created_by: 'm-orbit-owner' }),
    link('org-orbit', 'space-orbit-eng', 'g-orbit-tools', 'Team wiki', 'https://www.notion.so', { created_by: 'm-orbit-owner' }),
    link('org-orbit', 'space-orbit-eng', 'g-orbit-tools', 'Design files', 'https://www.figma.com', { created_by: 'm-orbit-owner' }),
    // More of Development, so its board is full: groups of different lengths, in columns.
    link(nw, dev, 'g-cloud', 'AWS console', 'https://aws.amazon.com'),
    link(nw, dev, 'g-cloud', 'Cloudflare', 'https://www.cloudflare.com'),
    link(nw, dev, 'g-cloud', 'Terraform Cloud', 'https://www.terraform.io'),
    link(nw, dev, 'g-data-dev', 'Neon console', 'https://neon.tech'),
    link(nw, dev, 'g-data-dev', 'Redis Insight', 'https://redis.io'),
    link(nw, dev, 'g-tools', 'Postman workspace', 'https://www.postman.com'),
    link(nw, dev, 'g-tools', 'Linear', 'https://linear.app'),
    link(nw, dev, 'g-tools', 'Slack', 'https://slack.com'),
    link(nw, dev, 'g-tools', 'Figma', 'https://www.figma.com'),
    link(nw, dev, 'g-tools', 'Notion', 'https://www.notion.so'),
    link(nw, dev, 'g-analytics', 'PostHog', 'https://posthog.com'),
    link(nw, dev, 'g-analytics', 'Mixpanel', 'https://mixpanel.com'),
    link(nw, dev, 'g-analytics', 'Plausible', 'https://plausible.io'),
    link(nw, dev, 'g-security', '1Password', 'https://1password.com'),
    link(nw, dev, 'g-security', 'Snyk', 'https://snyk.io'),
    link(nw, dev, 'g-security', 'Access policy', '/file?key=mock/security.pdf', { kind: 'file', file_key: 'mock/security.pdf', file_name: 'access-policy.pdf', file_size: 840_000, file_type: 'application/pdf', visibility: 'admins' }),
    link(nw, dev, 'g-docs', 'Runbooks', 'https://www.notion.so'),
    link(nw, dev, 'g-docs', 'Release notes', 'https://github.com'),
    link(nw, dev, 'g-monitoring', 'Datadog', 'https://www.datadoghq.com'),
    dataDoc('Pipeline overview', 'pipeline-overview.pdf', 'f-pipelines'),
    dataDoc('Warehouse schema', 'warehouse-schema.pdf', 'f-warehouse'),
    dataDoc('Naming rules', 'naming-rules.md', 'f-warehouse'),
    dataDoc('Style guide (dbt)', 'dbt-style-guide.md', 'f-transform'),
    dataDoc('Metric definitions', 'metric-definitions.md', 'f-metrics'),
    dataDoc('Revenue model', 'revenue-model.pdf', 'f-finance'),
    dataDoc('First week', 'first-week.md', 'f-onboarding'),
    dataDoc('Access requests', 'access-requests.md', 'f-onboarding'),
    dataDoc('Backfill runbook', 'backfill-runbook.md', 'f-runbooks'),
    dataDoc('Incident runbook', 'incident-runbook.md', 'f-runbooks'),
    dataDoc('Glossary', 'glossary.md', null),
    // Suggested into folders, waiting for review.
    dataDoc('Late data runbook', 'late-data-runbook.md', 'f-runbooks', { status: 'pending', created_by: 'm-nw-priya', reviewed_at: null, created_at: day(1) }),
    link(nw, data, 'g-data-docs', 'Table owners', 'https://owners.example.com', { status: 'pending', folder_id: 'f-warehouse', created_by: 'm-nw-mina', reviewed_at: null, created_at: day(2) }),
  ]

  return {
    users: Object.values(USERS),
    orgs: [
      { id: nw, slug: 'acme', name: 'Acme', allowed_domains: ['acme.com'] },
      { id: lumen, slug: 'lumen', name: 'Lumen Labs', allowed_domains: [] },
      { id: 'org-orbit', slug: 'orbit', name: 'Orbit', allowed_domains: ['lumenlabs.dev'] },
    ],
    members: [
      member('m-nw-alex', nw, USERS.alex.email, USERS.alex.name, 'admin', USERS.alex.id, 120),
      member('m-nw-sam', nw, USERS.sam.email, USERS.sam.name, 'admin', USERS.sam.id, 100),
      member('m-nw-priya', nw, USERS.priya.email, USERS.priya.name, 'member', USERS.priya.id, 60),
      member('m-nw-mina', nw, USERS.mina.email, USERS.mina.name, 'member', USERS.mina.id, 30),
      member('m-nw-jo', nw, 'jo@studio.design', '', 'member', null, 2),
      // Invited to Design by Mina, from a domain Acme doesn't let in: waits for an admin.
      member('m-nw-taylor', nw, 'taylor@freelance.example', '', 'member', null, 1, { approved: false, invited_by: 'm-nw-mina' }),
      member('m-lumen-alex', lumen, USERS.alexLumen.email, USERS.alexLumen.name, 'admin', USERS.alexLumen.id, 50),
      member('m-orbit-owner', 'org-orbit', 'owner@orbit.example', 'Robin Vale', 'admin', null, 40),
    ],
    spaces: [
      space(dev, nw, 'development', 'Development', 'code', 'indigo', 1),
      space(design, nw, 'design', 'Design', 'palette', 'pink', 2),
      space(data, nw, 'data', 'Data', 'chart', 'teal', 3),
      space(leads, nw, 'leadership', 'Leadership', 'briefcase', 'purple', 4, 'private'),
      space('space-lumen-research', lumen, 'research', 'Research', 'flask', 'green', 1),
      space('space-orbit-eng', 'org-orbit', 'engineering', 'Engineering', 'rocket', 'purple', 1),
    ],
    space_members: [
      // Alex created Acme and its spaces, so runs them; others run the ones given to them.
      { space_id: dev, member_id: 'm-nw-alex', role: 'admin' },
      { space_id: design, member_id: 'm-nw-alex', role: 'admin' },
      { space_id: data, member_id: 'm-nw-alex', role: 'admin' },
      { space_id: dev, member_id: 'm-nw-sam', role: 'admin' },
      { space_id: design, member_id: 'm-nw-mina', role: 'admin' },
      { space_id: leads, member_id: 'm-nw-alex', role: 'admin' },
      { space_id: design, member_id: 'm-nw-taylor', role: 'member' },
      { space_id: leads, member_id: 'm-nw-sam', role: 'member' },
      // Open spaces are everyone's: only private ones list their plain members.
      { space_id: leads, member_id: 'm-nw-priya', role: 'member' },
      { space_id: 'space-lumen-research', member_id: 'm-lumen-alex', role: 'admin' },
    ],
    groups: [
      group('g-online', nw, dev, 'Web app', 'blue', 1),
      group('g-monitoring', nw, dev, 'Monitoring', 'green', 2),
      group('g-cicd', nw, dev, 'CI / CD', 'purple', 3),
      group('g-docs', nw, dev, 'Docs', 'orange', 4),
      group('g-cloud', nw, dev, 'Cloud', 'yellow', 5),
      group('g-data-dev', nw, dev, 'Databases', 'teal', 6),
      group('g-tools', nw, dev, 'Tools', 'indigo', 7),
      group('g-analytics', nw, dev, 'Analytics', 'pink', 8),
      group('g-security', nw, dev, 'Security', 'red', 9),
      group('g-figma', nw, design, 'Figma', 'pink', 1),
      group('g-assets', nw, design, 'Assets', 'yellow', 2),
      group('g-dash', nw, data, 'Dashboards', 'teal', 1),
      group('g-data-docs', nw, data, 'Documentation', 'blue', 2),
      group('g-plans', nw, leads, 'Plans', 'purple', 1),
      group('g-lumen-papers', lumen, 'space-lumen-research', 'Papers', 'green', 1),
      group('g-orbit-tools', 'org-orbit', 'space-orbit-eng', 'Tools', 'purple', 1),
    ],
    folders: DATA_FOLDERS.map((one) => ({ ...one })),
    links,
    link_access: [],
    member_prefs: [],
    org_creators: [USERS.alex.email, USERS.alexLumen.email],
  }
}

/** One account as src/lib/accounts.ts keeps it in this browser. */
interface SavedAccount {
  userId: string
  email: string
  name: string
  slots: string[]
  orgs: { slug: string; name: string }[]
}

interface Setup {
  db: Tables
  /** Signed in: which user at which session paths. */
  sessions: { userId: string; slots: string[] }[]
  /** What src/lib/accounts.ts remembers, and the session the pages outside an organization use. */
  accounts: SavedAccount[]
  last?: string
}

const acmeAccount: SavedAccount = { userId: USERS.alex.id, email: USERS.alex.email, name: USERS.alex.name, slots: ['acme'], orgs: [{ slug: 'acme', name: 'Acme' }] }
const lumenAccount: SavedAccount = { userId: USERS.alexLumen.id, email: USERS.alexLumen.email, name: USERS.alexLumen.name, slots: ['lumen'], orgs: [{ slug: 'lumen', name: 'Lumen Labs' }] }

/**
 * Alex's role in Acme. As an admin, Alex also runs its spaces. As a member, Alex runs none,
 * or only Development, and the spaces are run by others: Sam and Mina, with Sam as the admin.
 */
function withRole(db: Tables, role: Role, spaceAdmin = false) {
  const alex = db.members.find((one) => one.id === 'm-nw-alex')!
  alex.role = role
  if (role === 'member') {
    // Sam takes over as an admin of the organization and of the spaces Alex ran (Mina runs Design).
    db.members.find((one) => one.id === 'm-nw-sam')!.role = 'admin'
    db.space_members = db.space_members.filter((row) => row.member_id !== alex.id && row.member_id !== 'm-nw-sam')
    for (const space_id of ['space-nw-dev', 'space-nw-data', 'space-nw-leads']) db.space_members.push({ space_id, member_id: 'm-nw-sam', role: 'admin' })
    // As a space admin, Alex runs Development (open to everyone) and Leadership (private) with Sam.
    if (spaceAdmin) for (const space_id of ['space-nw-dev', 'space-nw-leads']) db.space_members.push({ space_id, member_id: alex.id, role: 'admin' })
  }
  return db
}

export interface Scenario {
  id: string
  title: string
  description: string
  /** Whether Alex's role in Acme can be changed from the toolbar. */
  roles: boolean
  build: (role: Role) => Setup
}

const inAcme = (role: Role): Setup => ({
  db: withRole(world(), role),
  sessions: [{ userId: USERS.alex.id, slots: ['acme'] }],
  accounts: [acmeAccount],
  last: 'acme',
})

export const SCENARIOS: Scenario[] = [
  {
    id: 'signed-out',
    title: 'Signed out',
    description: 'Nobody is signed in on this browser.',
    roles: false,
    build: () => ({ db: world(), sessions: [], accounts: [] }),
  },
  {
    id: 'acme',
    title: 'One organization',
    description: 'Alex is signed in to Acme only.',
    roles: true,
    build: inAcme,
  },
  {
    id: 'folders-opened',
    title: 'Folders opened',
    description: "Alex is signed in to Acme and opened every folder of Data's Documentation (folders start closed).",
    roles: true,
    build: (role) => {
      const setup = inAcme(role)
      setup.db.member_prefs.push({ ...NO_PREFS, member_id: 'm-nw-alex', open_folders: DATA_FOLDERS.map((one) => one.id) })
      return setup
    },
  },
  {
    id: 'space-admin',
    title: 'Admin of one space',
    description: 'Alex is a member of Acme and an admin of Development and Leadership.',
    roles: false,
    build: () => ({ ...inAcme('member'), db: withRole(world(), 'member', true) }),
  },
  {
    id: 'several',
    title: 'Two emails',
    description: 'Acme with alex@acme.com, Lumen Labs with alex.morgan@lumenlabs.dev. That email may also join Orbit.',
    roles: true,
    build: (role) => ({
      db: withRole(world(), role),
      sessions: [
        { userId: USERS.alex.id, slots: ['acme'] },
        { userId: USERS.alexLumen.id, slots: ['lumen'] },
      ],
      accounts: [acmeAccount, lumenAccount],
      last: 'acme',
    }),
  },
  {
    id: 'lumen',
    title: 'Can join by domain',
    description: 'Signed in as alex.morgan@lumenlabs.dev, whose domain opens Orbit.',
    roles: false,
    build: () => ({ db: world(), sessions: [{ userId: USERS.alexLumen.id, slots: ['lumen'] }], accounts: [lumenAccount], last: 'lumen' }),
  },
  {
    id: 'newcomer',
    title: 'No organization',
    description: 'Signed in as sam.rivera@gmail.com, who is in no organization and may not create one.',
    roles: false,
    build: () => ({ db: world(), sessions: [{ userId: USERS.newcomer.id, slots: ['_new'] }], accounts: [], last: '_new' }),
  },
  {
    id: 'join-domain',
    title: 'Opens an organization to join',
    description: "alex.morgan@lumenlabs.dev opens Orbit's address. Orbit lets @lumenlabs.dev in, so it may join.",
    roles: false,
    build: () => ({ db: world(), sessions: [{ userId: USERS.alexLumen.id, slots: ['lumen', 'orbit'] }], accounts: [lumenAccount], last: 'lumen' }),
  },
  {
    id: 'no-access',
    title: 'Not a member',
    description: "alex@acme.com opens Orbit's address, where it isn't a member and its domain isn't let in.",
    roles: false,
    build: () => ({ ...inAcme('admin'), sessions: [{ userId: USERS.alex.id, slots: ['acme', 'orbit'] }] }),
  },
  {
    id: 'many-spaces',
    title: 'Many spaces',
    description: 'Acme with 30 spaces, so the sidebar has more than fits.',
    roles: false,
    build: () => {
      const setup = inAcme('admin')
      const teams: [string, string, Color][] = [
        ['Marketing', 'megaphone', 'orange'], ['Sales', 'target', 'green'], ['Support', 'headset', 'teal'], ['Finance', 'chart', 'yellow'],
        ['People', 'users', 'pink'], ['Legal', 'book', 'graphite'], ['Security', 'shield', 'red'], ['Platform', 'server', 'indigo'],
        ['Mobile', 'smartphone', 'blue'], ['Infrastructure', 'cloud', 'blue'], ['Data science', 'flask', 'purple'], ['Research', 'lightbulb', 'yellow'],
        ['Brand', 'swatches', 'pink'], ['Growth', 'rocket', 'green'], ['Partnerships', 'globe', 'teal'], ['Operations', 'box', 'orange'],
        ['Quality', 'target', 'red'], ['Hardware', 'cpu', 'graphite'], ['Analytics', 'database', 'indigo'], ['Product', 'layers', 'purple'],
        ['Customer success', 'headset', 'green'], ['Recruiting', 'users', 'blue'], ['Events', 'megaphone', 'pink'], ['Documentation', 'book', 'teal'],
        ['Design systems', 'shapes', 'purple'], ['Board', 'briefcase', 'graphite'],
      ]
      teams.forEach(([name, logo, color], index) => {
        const id = `space-nw-many-${index}`
        // Every fifth one private, to show the lock among them.
        setup.db.spaces.push(space(id, 'org-acme', name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, logo, color, 10 + index, index % 5 === 4 ? 'private' : 'org'))
        setup.db.space_members.push({ space_id: id, member_id: 'm-nw-alex', role: 'admin' })
      })
      return setup
    },
  },
  {
    id: 'own-layout',
    title: 'A board arranged by yourself',
    description: 'Alex, a member of Acme, moved the cards of Development around and resized one. Only Alex sees it that way.',
    roles: false,
    build: () => {
      const setup = inAcme('member')
      const cards = setup.db.groups.filter((one) => one.space_id === 'space-nw-dev').map((one) => one.id)
      // Two columns instead of the default's, in the opposite order, and one short card.
      const half = Math.ceil(cards.length / 2)
      setup.db.member_prefs.push({
        member_id: 'm-nw-alex',
        group_order: [],
        group_layout: { 'space-nw-dev': [cards.slice(half).reverse(), cards.slice(0, half).reverse()] },
        link_order: {},
        hidden_groups: [],
        hidden_links: [],
        recent_links: {},
        card_sizes: { 'space-nw-dev': { heights: { [cards[0]]: 120 } } },
      })
      return setup
    },
  },
  {
    id: 'recent-links',
    title: 'Links opened lately',
    description: 'Alex, an admin of Acme, opened Figma, 1Password and Grafana in Development lately, so the search lists them before anything is typed.',
    roles: false,
    build: () => {
      const setup = inAcme('admin')
      const idOf = (title: string) => setup.db.links.find((one) => one.space_id === 'space-nw-dev' && one.title === title)!.id
      setup.db.member_prefs.push({
        member_id: 'm-nw-alex',
        group_order: [],
        group_layout: {},
        link_order: {},
        hidden_groups: [],
        hidden_links: [],
        recent_links: { 'space-nw-dev': ['Figma', '1Password', 'Grafana'].map(idOf) },
        card_sizes: {},
      })
      return setup
    },
  },
  {
    id: 'files',
    title: 'Files of every kind',
    description: 'Development has a document, notes, a picture, a PDF, a spreadsheet, and two files that try to run a script.',
    roles: true,
    build: (role) => {
      const setup = inAcme(role)
      const like = setup.db.links.find((one) => one.file_key === 'mock/architecture.pdf')!
      const files: [title: string, name: string, type: string, size: number][] = [
        ['Deploy runbook', 'runbook.md', 'text/markdown', 1_200],
        ['On-call notes', 'notes.txt', 'text/plain', 96],
        ['System diagram', 'diagram.png', 'image/png', 48_000],
        ['Budget', 'budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 310_000],
        ['Old landing page', 'page.html', 'text/html', 140],
        ['Imported notes', 'imported.md', 'text/markdown', 330],
      ]
      for (const [title, name, type, size] of files) {
        const key = `mock/${name}`
        setup.db.links.push({ ...like, id: `l-file-${name}`, title, url: `/file?key=${key}`, file_key: key, file_name: name, file_type: type, file_size: size })
      }
      return setup
    },
  },
  {
    id: 'empty-org',
    title: 'Empty organization',
    description: 'Acme without any space yet.',
    roles: false,
    build: () => {
      const setup = inAcme('admin')
      setup.db.spaces = setup.db.spaces.filter((one) => one.org_id !== 'org-acme')
      setup.db.groups = setup.db.groups.filter((one) => one.org_id !== 'org-acme')
      setup.db.links = setup.db.links.filter((one) => one.org_id !== 'org-acme')
      setup.db.space_members = setup.db.space_members.filter((row) => !row.space_id.startsWith('space-nw-'))
      return setup
    },
  },
  {
    id: 'empty-space',
    title: 'Empty space',
    description: 'Acme with a single space and nothing in it yet.',
    roles: false,
    build: () => {
      const setup = inAcme('admin')
      setup.db.spaces = setup.db.spaces.filter((one) => one.org_id !== 'org-acme' || one.slug === 'development')
      setup.db.groups = setup.db.groups.filter((one) => one.org_id !== 'org-acme')
      setup.db.links = setup.db.links.filter((one) => one.org_id !== 'org-acme')
      return setup
    },
  },
]

/** Sets a scenario up from scratch: the database, the sessions, and this browser's list of accounts. */
export function applyScenario(id: string, role: Role = 'admin', screen: string | null = null) {
  const scenario = SCENARIOS.find((one) => one.id === id) ?? SCENARIOS[1]
  const setup = scenario.build(role)
  const state: MockState = { db: setup.db, sessions: {}, tokens: {}, pendingLink: null, scenario: { id: scenario.id, role }, screen, act: screen }
  for (const { userId, slots } of setup.sessions) {
    const token = `token-${userId}-${crypto.randomUUID().slice(0, 8)}`
    state.tokens[token] = userId
    for (const slot of slots) state.sessions[slot] = token
  }
  setState(state)
  try {
    localStorage.setItem('teamshelf.accounts', JSON.stringify({ accounts: setup.accounts, last: setup.last }))
    // Each organization's remembered space: start from its first one.
    // (Kept per tab in mock mode, see per-tab-storage.js.)
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('teamshelf:space:')) sessionStorage.removeItem(key)
  } catch {
    // Without storage the app forgets which accounts it holds, as it would in a private window.
  }
}
