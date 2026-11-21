// Sets Teamshelf up on your own accounts: a Neon database with sign-in, a Cloudflare R2 bucket
// for files, and a Netlify site for the app (and, with --back-office, one for the back office).
// Usage: pnpm cloud [--skip-r2] [--skip-netlify] [--back-office]
//
// It can be run again: every step first looks at what is already there (.env remembers what it
// made), so a run that stopped halfway picks up where it left off. See SETUP.md.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import pg from 'pg'

const flags = new Set(process.argv.slice(2))
const ENV_FILE = new URL('../.env', import.meta.url)
const DATABASE = 'neondb'
const FILES_ROLE = 'teamshelf_files'

// ---- Small tools ----------------------------------------------------------------------------

const terminal = createInterface({ input: process.stdin, output: process.stdout })
const say = (text) => console.log(`\n▸ ${text}`)
const note = (text) => console.log(`  ${text}`)

async function ask(question, fallback = '') {
  const answer = (await terminal.question(`  ${question}${fallback ? ` (${fallback})` : ''}: `)).trim()
  return answer || fallback
}

function stop(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Runs a command. `show` hands it the terminal (to sign in, or to watch a deploy); otherwise its output comes back. `app` runs it in that app's folder. */
function run(command, args, { show = false, allowFailure = false, app } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd: app ? join(ROOT, 'apps', app) : ROOT, stdio: show ? 'inherit' : ['inherit', 'pipe', 'pipe'] })
  if (result.status !== 0 && !allowFailure) stop(`\`${command} ${args.join(' ')}\` failed.\n${result.stderr ?? ''}`)
  return { ok: result.status === 0, out: (result.stdout ?? '').trim(), err: (result.stderr ?? '').trim() }
}

const cli = (name, args, options) => run('npx', ['--yes', name, ...args], options)

/** The first value under this key, anywhere in what a command printed as JSON. */
function find(value, key) {
  if (!value || typeof value !== 'object') return undefined
  if (typeof value[key] === 'string' && value[key]) return value[key]
  for (const inner of Object.values(value)) {
    const found = find(inner, key)
    if (found) return found
  }
  return undefined
}

const json = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ---- .env -------------------------------------------------------------------------------------

function readEnv() {
  if (!existsSync(ENV_FILE)) writeFileSync(ENV_FILE, readFileSync(new URL('../.env.example', import.meta.url)))
  const values = {}
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
  }
  return values
}

/** Writes values into .env, in place where the name is already there, at the end otherwise. */
function saveEnv(changes) {
  let text = readFileSync(ENV_FILE, 'utf8')
  for (const [name, value] of Object.entries(changes)) {
    const line = `${name}="${value}"`
    const existing = new RegExp(`^${name}=.*$`, 'm')
    text = existing.test(text) ? text.replace(existing, line) : `${text.replace(/\n*$/, '\n')}${line}\n`
  }
  writeFileSync(ENV_FILE, text)
  Object.assign(env, changes)
}

const env = readEnv()

// ---- Neon: the database, sign-in and the Data API ---------------------------------------------

const neon = (args, options) => cli('neonctl', args, options)
const neonJson = (args) => json(neon([...args, '--output', 'json'], { allowFailure: true }).out)

async function setUpNeon() {
  say('Neon: the database and sign-in')
  if (!neon(['me'], { allowFailure: true }).ok) {
    note('A browser opens to sign in to Neon. No account yet? Create one there (free, no card).')
    neon(['auth'], { show: true })
  }

  if (!env.NEON_PROJECT_ID) {
    const name = await ask('Name for the Neon project', 'teamshelf')
    const created = neonJson(['projects', 'create', '--name', name, ...(process.env.NEON_ORG_ID ? ['--org-id', process.env.NEON_ORG_ID] : [])])
    const id = find(created?.project, 'id')
    if (!id) stop('The Neon project could not be created. With more than one Neon organization, run again with NEON_ORG_ID=<id> (see `npx neonctl orgs list`).')
    saveEnv({ NEON_PROJECT_ID: id })
  }
  const project = ['--project-id', env.NEON_PROJECT_ID]
  note(`Project ${env.NEON_PROJECT_ID}`)

  if (!env.DATABASE_URL) saveEnv({ DATABASE_URL: neon(['connection-string', ...project, '--database-name', DATABASE]).out })

  // Sign-in first: the Data API is told to trust it.
  if (!find(neonJson(['neon-auth', 'status', ...project]), 'base_url')) neon(['neon-auth', 'enable', ...project, '--database-name', DATABASE])
  const authUrl = find(neonJson(['neon-auth', 'status', ...project]), 'base_url')
  if (!authUrl) stop('Sign-in (Neon Auth) could not be turned on. Turn it on in the Neon Console (Auth), then run this again.')

  if (!find(neonJson(['data-api', 'get', ...project, '--database', DATABASE]), 'url')) neon(['data-api', 'create', ...project, '--database', DATABASE, '--auth-provider', 'neon_auth'])
  const dataUrl = find(neonJson(['data-api', 'get', ...project, '--database', DATABASE]), 'url')
  if (!dataUrl) stop('The Data API could not be turned on. Turn it on in the Neon Console (Data API, with Neon Auth), then run this again.')
  saveEnv({ VITE_NEON_AUTH_URL: authUrl, VITE_NEON_DATA_API_URL: dataUrl })

  neon(['neon-auth', 'domain', 'allow-localhost', 'enable', ...project], { allowFailure: true })
  await turnOnSignInLinks()
  await prepareDatabase()
  neon(['data-api', 'refresh-schema', ...project, '--database', DATABASE], { allowFailure: true })
  note('Database ready.')
}

/** Sign-in is by a link sent by email. The CLI has no switch for it, so this asks Neon's API. */
async function turnOnSignInLinks() {
  const credentials = join(homedir(), '.config', 'neonctl', 'credentials.json')
  const token = process.env.NEON_API_KEY || (existsSync(credentials) ? json(readFileSync(credentials, 'utf8'))?.access_token : null)
  const branches = neonJson(['branches', 'list', '--project-id', env.NEON_PROJECT_ID])
  const branch = (Array.isArray(branches) ? branches : (branches?.branches ?? [])).find((one) => one.default || one.primary)
  const manual = 'Check that "Magic link" is on: Neon Console → Auth → Configuration.'
  if (!token || !branch) return note(manual)
  const response = await fetch(`https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches/${branch.id}/auth/plugins/magic-link`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  }).catch(() => null)
  if (!response?.ok) note(manual)
}

/** The tables and rules (db/migrations), the user the file cleanup connects as, and who may create organizations. */
async function prepareDatabase() {
  const client = new pg.Client({ connectionString: env.DATABASE_URL })
  await client.connect()
  try {
    // The migrations grant to this user, so it comes first. Its password is only kept in .env.
    const { rowCount } = await client.query('select 1 from pg_roles where rolname = $1', [FILES_ROLE])
    if (!rowCount || !env.FILE_CLEANUP_DATABASE_URL) {
      const password = randomBytes(24).toString('hex')
      await client.query(`${rowCount ? 'alter' : 'create'} role ${FILES_ROLE} login password '${password}'`)
      const url = new URL(env.DATABASE_URL)
      url.username = FILES_ROLE
      url.password = password
      saveEnv({ FILE_CLEANUP_DATABASE_URL: url.href })
    }
  } finally {
    await client.end()
  }

  run('node', ['db/migrate.mjs'], { show: true })

  const email = (await ask('Your email (it may create organizations and open the back office; add more later, see docs/HOW_IT_WORKS.md)', env.SETUP_EMAIL)).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) stop('That is not an email address.')
  const again = new pg.Client({ connectionString: env.DATABASE_URL })
  await again.connect()
  await again.query('insert into public.org_creators (email) values ($1) on conflict do nothing', [email])
  await again.query('insert into public.super_admins (email) values ($1) on conflict do nothing', [email])
  await again.end()
  saveEnv({ SETUP_EMAIL: email })
}

// ---- Cloudflare R2: where files are kept --------------------------------------------------------

const wrangler = (args, options) => cli('wrangler', args, options)

async function setUpR2() {
  say('Cloudflare R2: file storage (optional: without it, Teamshelf keeps links only)')
  if (env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) return note('Already set up.')
  if ((await ask('Set up file storage now? R2 needs a card on file at Cloudflare, with a free allowance. y/n', 'y')).toLowerCase() !== 'y') return

  let who = wrangler(['whoami'], { allowFailure: true })
  if (!/[0-9a-f]{32}/.test(who.out)) {
    note('A browser opens to sign in to Cloudflare. No account yet? Create one there, then turn on R2 in its dashboard.')
    wrangler(['login'], { show: true })
    who = wrangler(['whoami'])
  }
  const accounts = [...new Set(who.out.match(/[0-9a-f]{32}/g) ?? [])]
  const account = accounts.length === 1 ? accounts[0] : await ask(`Cloudflare account id (${accounts.join(', ')})`)
  if (!/^[0-9a-f]{32}$/.test(account)) stop('The Cloudflare account id could not be read. Find it in the dashboard (R2 → Overview), then run again.')

  const bucket = await ask('Name for the bucket', env.R2_BUCKET || 'teamshelf-files')
  const made = wrangler(['r2', 'bucket', 'create', bucket], { allowFailure: true })
  if (!made.ok && !/already exists/i.test(made.out + made.err)) stop(`The bucket could not be created. Is R2 turned on for the account?\n${made.err}`)

  // The browser uploads to the bucket and reads from it directly, so the bucket must allow the site.
  const cors = join(homedir(), '.teamshelf-r2-cors.json')
  writeFileSync(cors, JSON.stringify({ rules: [{ allowed: { origins: ['*'], methods: ['GET', 'PUT'], headers: ['content-type'] }, maxAgeSeconds: 3600 }] }))
  if (!wrangler(['r2', 'bucket', 'cors', 'set', bucket, '--file', cors], { allowFailure: true }).ok) {
    note('Set the bucket\'s CORS policy by hand (R2 → the bucket → Settings → CORS policy):')
    note('[{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["content-type"] }]')
  }

  note('One thing only you can do: create the keys the site signs uploads with.')
  note(`Open https://dash.cloudflare.com/${account}/r2/api-tokens → Create API token → "Object Read & Write", this bucket only.`)
  const accessKey = await ask('Access Key ID')
  const secret = await ask('Secret Access Key')
  if (!accessKey || !secret) return note('Skipped. Run `pnpm cloud` again when you have the keys.')
  saveEnv({ R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secret })
  note('File storage ready.')
}

// ---- Netlify: the site --------------------------------------------------------------------------

const netlify = (args, options) => cli('netlify-cli', args, options)

/** What the site and its functions need. DATABASE_URL is not among them: it stays on this machine. */
const SITE_VARIABLES = ['VITE_NEON_AUTH_URL', 'VITE_NEON_DATA_API_URL', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'FILE_CLEANUP_DATABASE_URL']

/**
 * Publishes one app as a Netlify site of its own, and tells Neon to trust its address. The app
 * itself is published from the top of the repository, where its netlify.toml is; the back office
 * from its own folder.
 */
async function publish(app, variables) {
  const here = app === 'web' ? {} : { app }
  if (!existsSync(join(ROOT, ...(app === 'web' ? [] : ['apps', app]), '.netlify', 'state.json'))) {
    note('Creating the site. Pick a team and a name when asked.')
    netlify(['sites:create'], { ...here, show: true })
  }
  for (const name of variables) if (env[name]) netlify(['env:set', name, env[name]], here)

  note('Building and publishing. This takes a few minutes.')
  netlify(['deploy', '--build', '--prod'], { ...here, show: true })

  const url = find(json(netlify(['status', '--json'], { ...here, allowFailure: true }).out), 'url')?.replace(/\/+$/, '')
  if (!url) return note("Published. Add the site's address to Neon (Auth → Configuration → Domains) so sign-in links may return to it.")
  // Sign-in links only return to addresses Neon was told to trust.
  neon(['neon-auth', 'domain', 'add', url, '--project-id', env.NEON_PROJECT_ID], { allowFailure: true })
  note(`Live at ${url}`)
  return url
}

async function setUpNetlify() {
  say('Netlify: the site')
  if (!netlify(['status'], { allowFailure: true }).ok) {
    note('A browser opens to sign in to Netlify. No account yet? Create one there (free).')
    netlify(['login'], { show: true })
  }
  const url = await publish('web', SITE_VARIABLES)
  if (url) saveEnv({ VITE_SITE_URL: url })

  if (flags.has('--back-office')) {
    say('Netlify: the back office (reports, for the super admins)')
    await publish('back-office', ['VITE_NEON_AUTH_URL', 'VITE_NEON_DATA_API_URL'])
  }
}

// ---- All of it ----------------------------------------------------------------------------------

await setUpNeon()
if (!flags.has('--skip-r2')) await setUpR2()
if (!flags.has('--skip-netlify')) await setUpNetlify()
terminal.close()

say('Done.')
note('Run it on this machine: pnpm dev  (the app: http://localhost:3011, the back office: http://localhost:3015)')
note(`Sign in with ${env.SETUP_EMAIL} and create your organization.`)
note('Before your team uses it: SETUP.md → "Going live".')
