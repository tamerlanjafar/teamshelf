// Environments are not a field of a link: they are read from its name, "Thing - Environment".
// Each space lists the environments its links may name (Staging and Prod to start with). This
// is what the app knows about the usual ones: how else they are written, and their order.

interface KnownEnvironment {
  /** How it is written on the board. */
  label: string
  /** Other ways people write it. All lower case. */
  aliases: string[]
  /** Also an ordinary word ("Load Test Report"): only an environment at the end of a name. */
  loose?: boolean
}

/** From the safest to production. Links of one thing are shown in this order. */
const KNOWN: KnownEnvironment[] = [
  { label: 'Local', aliases: ['local', 'localhost'], loose: true },
  { label: 'Dev', aliases: ['dev', 'development'] },
  { label: 'Test', aliases: ['test', 'testing'], loose: true },
  { label: 'QA', aliases: ['qa'] },
  { label: 'Staging', aliases: ['staging', 'stage', 'stg'] },
  { label: 'UAT', aliases: ['uat'] },
  { label: 'Preprod', aliases: ['preprod', 'pre-prod', 'preproduction'] },
  { label: 'Prod', aliases: ['prod', 'production', 'prd'] },
  { label: 'Live', aliases: ['live'], loose: true },
]

const PRODUCTION = ['Prod', 'Live']

const find = (word: string) => KNOWN.findIndex((environment) => environment.aliases.includes(word.trim().toLowerCase()))

/** The usual spelling of an environment ("production" → "Prod"), or null for a word that isn't one. */
export function knownEnvironment(word: string): string | null {
  return KNOWN[find(word)]?.label ?? null
}

/** Environments every app knows, for a space's settings to offer. */
export const KNOWN_ENVIRONMENTS = KNOWN.map((environment) => environment.label)

/**
 * The environment a word names, for a space with these environments: one of the space's own
 * ("Sandbox"), or one the app knows ("production" → Prod), which `inSpace` says the space has or not.
 */
export function environmentOf(word: string, spaceEnvironments: string[]): { label: string; inSpace: boolean; loose: boolean } | null {
  const own = spaceEnvironments.find((environment) => environment.toLowerCase() === word.toLowerCase())
  const known = KNOWN[find(word)]
  if (own) return { label: known && spaceEnvironments.includes(known.label) ? known.label : own, inSpace: true, loose: Boolean(known?.loose) }
  if (!known) return null
  return { label: known.label, inSpace: spaceEnvironments.includes(known.label), loose: Boolean(known.loose) }
}

/** Production gets a warning color, so it isn't opened by mistake. */
export const isProduction = (environment: string) => PRODUCTION.includes(knownEnvironment(environment) ?? '')

/**
 * Sorts environments in the order of the space's list. Without one (or for names not in it):
 * from the safest to production, with names the app doesn't know after the known ones that
 * aren't production, in alphabetical order.
 */
export function compareEnvironments(a: string, b: string, spaceOrder: string[] = []): number {
  const listed = (environment: string) => {
    const index = spaceOrder.indexOf(environment)
    return index === -1 ? spaceOrder.length : index
  }
  if (listed(a) !== listed(b)) return listed(a) - listed(b)
  const place = (environment: string) => {
    const index = find(environment)
    if (index === -1) return KNOWN.length - PRODUCTION.length - 0.5
    return index
  }
  return place(a) - place(b) || a.localeCompare(b)
}

const SEPARATOR = ' - '

/** "Online WEB - Staging" → the thing and its environment. A name without " - " has no environment. */
export function splitName(title: string): { base: string; environment: string | null } {
  const at = title.lastIndexOf(SEPARATOR)
  const base = title.slice(0, at).trim()
  const environment = title.slice(at + SEPARATOR.length).trim()
  return at > 0 && base && environment ? { base, environment } : { base: title.trim(), environment: null }
}

export const joinName = (base: string, environment: string) => `${base}${SEPARATOR}${environment}`

/**
 * A name without its group's name in front: "Jenkins Retail" on the Jenkins card is "Retail".
 * The card already says the group, so a name doesn't repeat it. Only a whole word is taken
 * off ("Jenkinsfile" stays), and never the whole name.
 */
export function withoutGroupName(name: string, groupName: string): string {
  const text = name.trim()
  const group = groupName.trim()
  if (!group || !text.toLowerCase().startsWith(group.toLowerCase())) return text
  const rest = /^(?:\s+[-–—|:,]?|[–—|:,])\s*(.+)$/.exec(text.slice(group.length))?.[1].trim()
  return rest || text
}
