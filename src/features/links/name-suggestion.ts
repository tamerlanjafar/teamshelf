// A link's environment is read from its name, written "Thing - Environment". People write
// it in other ways ("jenkins staging online"), and such a link then doesn't line up with its
// siblings on the board. This finds an environment word in a name and proposes the usual form.

// A relative path, so the tests can run in plain Node, which doesn't know the "@/" shorthand.
import { joinName, knownEnvironment, splitName } from '../../lib/environments.ts'

const DASHES = '[-–—|:(),]'

/** "jenkins" → "Jenkins". A word that already has a capital or a digit ("WEB", "v2") is left alone. */
const capitalize = (word: string) => (/^[a-z][a-z-]*$/.test(word) ? word[0].toUpperCase() + word.slice(1) : word)

/** For comparing names of things: lower case, without the group's name in front. */
function comparable(base: string, groupName: string) {
  const text = base.trim().toLowerCase().replace(/\s+/g, ' ')
  const prefix = `${groupName.trim().toLowerCase()} `
  return groupName.trim() && text.startsWith(prefix) ? text.slice(prefix.length) : text
}

/**
 * The name in the usual form, when it mentions exactly one environment and isn't in that form
 * already. Otherwise null: a name without an environment ("Online Account Service") is fine as it is.
 *
 * `siblingTitles` are the names of the other links in the same group: if one of them is the
 * same thing, its spelling is used, so the two share a line.
 */
export function suggestName(title: string, groupName: string, siblingTitles: string[]): string | null {
  // Punctuation around a word doesn't keep it from being an environment: "(staging)", "WEB-Prod".
  const words = title
    .replace(new RegExp(`\\s*${DASHES}+\\s*`, 'g'), (separator) => (separator.trim().length ? ` ${separator.trim()} ` : ' '))
    .split(/\s+/)
    .filter(Boolean)

  const environments: string[] = []
  const rest: string[] = []
  for (const word of words) {
    const environment = knownEnvironment(word)
    if (environment) environments.push(environment)
    else rest.push(word)
  }
  if (new Set(environments).size !== 1) return null

  // Put the name of the thing back together, without separators left dangling at its ends,
  // and with a hyphen that joined two of its words kept as it was ("self-service").
  let base = rest.join(' ').replace(new RegExp(`^(${DASHES}\\s*)+|(\\s*${DASHES})+$`, 'g'), '').replace(/\s+-\s+/g, '-').trim()
  if (!base) return null
  base = base.split(' ').map(capitalize).join(' ')

  const sibling = siblingTitles.map((other) => splitName(other).base).find((other) => comparable(other, groupName) === comparable(base, groupName))
  const suggestion = joinName(sibling ?? base, environments[0])
  return suggestion === title.trim() ? null : suggestion
}
