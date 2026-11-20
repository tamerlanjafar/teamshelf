// Environments are not a field of a link: they are read from its name, "Thing - Environment".
// This is what the app knows about the usual ones: how they are written, and their order.

interface KnownEnvironment {
  /** How it is written on the board. */
  label: string
  /** Other ways people write it. All lower case. */
  aliases: string[]
}

/** From the safest to production. Links of one thing are shown in this order. */
const KNOWN: KnownEnvironment[] = [
  { label: 'Local', aliases: ['local', 'localhost'] },
  { label: 'Dev', aliases: ['dev', 'development'] },
  { label: 'Test', aliases: ['test', 'testing'] },
  { label: 'QA', aliases: ['qa'] },
  { label: 'Staging', aliases: ['staging', 'stage', 'stg'] },
  { label: 'UAT', aliases: ['uat'] },
  { label: 'Preprod', aliases: ['preprod', 'pre-prod', 'preproduction'] },
  { label: 'Prod', aliases: ['prod', 'production'] },
  { label: 'Live', aliases: ['live'] },
]

const PRODUCTION = ['Prod', 'Live']

const find = (word: string) => KNOWN.findIndex((environment) => environment.aliases.includes(word.trim().toLowerCase()))

/** The usual spelling of an environment ("production" → "Prod"), or null for a word that isn't one. */
export function knownEnvironment(word: string): string | null {
  return KNOWN[find(word)]?.label ?? null
}

/** Production gets a warning color, so it isn't opened by mistake. */
export const isProduction = (environment: string) => PRODUCTION.includes(knownEnvironment(environment) ?? '')

/**
 * Sorts environments from the safest to production. Names the app doesn't know come after
 * the known ones that aren't production, in alphabetical order.
 */
export function compareEnvironments(a: string, b: string): number {
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
