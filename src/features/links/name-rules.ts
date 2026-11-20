// The rules a link's name follows. A name that breaks one can't be saved, by anyone: the form
// shows the first broken rule under the name, and the database checks the same rules again
// (app.link_name_error in db/migrations/012_spaces.sql), except the two that compare a name
// with the other links of its group.
//
// The aim: every card reads the same way. "Thing - Environment", the thing spelled like its
// siblings spell it, no group name in front, no decoration.

// A relative path, so the tests can run in plain Node, which doesn't know the "@/" shorthand.
import { environmentOf, withoutGroupName } from '../../lib/environments.ts'

export const NAME_MAX = 60

/** Names that say nothing about what the link opens. */
const GENERIC = ['link', 'links', 'website', 'site', 'url', 'page', 'here', 'home', 'new link', 'untitled', 'click here', 'open', 'app']

export interface NameContext {
  /** The group the link is in, or the name of a new one. */
  groupName: string
  /** The names of the other links in that group. */
  siblings: string[]
  /** What may follow " - ": the environments of the link's space. */
  environments: string[]
}

const quote = (text: string) => `“${text}”`
const comparable = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')
const capitalized = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)

function splitAtEnvironment(name: string) {
  const at = name.lastIndexOf(' - ')
  return at > 0 ? { base: name.slice(0, at), environment: name.slice(at + 3) } : { base: name, environment: null }
}

/** The first rule this name breaks, as the sentence shown under the field. Null for a good name. */
export function nameError(typed: string, { groupName, siblings, environments }: NameContext): string | null {
  const name = typed.trim()
  const listed = environments.length ? environments.join(', ') : 'none yet'

  if (!name) return 'Give the link a name.'
  if (name.length < 2) return 'A name needs at least 2 characters.'
  if (name.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters. This one has ${name.length}.`

  if (/:\/\/|^www\./i.test(name) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(name)) {
    return 'This is an address, not a name. Write what the link opens, like “Grafana” or “Online - Prod”.'
  }

  const withoutGroup = withoutGroupName(name, groupName)
  if (withoutGroup !== name) return `Drop ${quote(groupName.trim())} from the front. The card already shows the group, so write ${quote(withoutGroup)}.`

  const separator = /[–—|:_]/.exec(name)
  if (separator) return `Remove ${quote(separator[0])}. Separate the environment with “ - ” (space, hyphen, space), and use spaces between words.`

  const odd = [...name].find((character) => !/[\p{L}\p{N} .&'()/+#,-]/u.test(character))
  if (odd) return `Remove ${quote(odd)}. Names use letters, digits, spaces and . , & ' ( ) / + # -`

  if (/\s{2,}/.test(name)) return 'Use one space between words.'
  if (/\s-(?!\s)|(?<!\s)-\s/.test(name)) return 'Put a space on both sides of the hyphen: “ - ”.'
  if (/[.,/&+-]$/.test(name)) return `Remove the ${quote(name.at(-1)!)} at the end.`
  if (/^[^\p{L}\p{N}(]/u.test(name)) return 'Start the name with a letter or a digit.'
  if ((name.match(/\(/g) ?? []).length !== (name.match(/\)/g) ?? []).length) return 'Close the bracket, or remove it.'
  if (GENERIC.includes(comparable(name))) return `${quote(name)} doesn't say what the link opens. Name the tool or the page, like “Jenkins” or “Release Notes”.`

  // Environments: where in the name, how many, and how they are written.
  const words = name.split(/[\s()/]+|-(?=[A-Za-z])/).filter(Boolean)
  const found = words
    .map((word, index) => ({ word, environment: environmentOf(word, environments), last: index === words.length - 1 }))
    // "Load Test Report", "Live Chat": these words are only an environment at the end.
    .filter((entry) => entry.environment && (!entry.environment.loose || entry.last))
  const labels = [...new Set(found.map((entry) => entry.environment!.label))]
  if (labels.length > 1) return `One link opens one environment. This name has ${labels.map(quote).join(' and ')}: add a separate link for each.`
  if (name.split(' - ').length > 2) return 'Use “ - ” once, only before the environment.'

  const { base, environment } = splitAtEnvironment(name)
  if (labels.length === 1) {
    const { label, inSpace } = found[0].environment!
    if (!inSpace) return `${quote(label)} isn't an environment of this space. Use one of: ${listed}. A space admin can add more in the space's settings.`
    const thing = capitalized(
      name
        .replace(/[()]/g, ' ')
        .split(/\s+/)
        .flatMap((word) => (/^\w+-\w+$/.test(word) && environmentOf(word.split('-').at(-1)!, environments) ? word.split('-') : [word]))
        .filter((word) => word && word !== '-' && !environmentOf(word, environments))
        .join(' '),
    )
    if (!thing) return `Name the thing this link opens. ${quote(name)} alone could be anything: try ${quote(`Online - ${label}`)}.`
    const wanted = `${thing} - ${label}`
    if (environment && environmentOf(environment, environments)) {
      if (environment !== label) return `Write the environment as ${quote(label)}, not ${quote(environment)}.`
    } else if (environmentOf(words.at(-1)!, environments)) {
      return `Separate the environment with “ - ”: ${quote(wanted)}.`
    } else {
      return `Put the environment last: ${quote(wanted)}.`
    }
  } else if (environment) {
    return `${quote(environment)} isn't an environment of this space. After “ - ” write one of: ${listed}. If it isn't an environment, drop the hyphen: ${quote(`${base} ${environment}`)}.`
  }

  // Capitals.
  const first = name.split(/[\s(]+/).filter(Boolean)[0]
  if (/^\p{Ll}+$/u.test(first.replace(/[-'.]/g, ''))) return `Start with a capital letter: ${quote(capitalized(name))}.`
  const shouted = name.split(/[\s()/-]+/).find((word) => /^\p{Lu}{6,}$/u.test(word))
  if (shouted) return `Write ${quote(shouted)} as ${quote(shouted[0] + shouted.slice(1).toLowerCase())}. Capitals are for abbreviations of up to 5 letters, like API or UAT.`

  // Agree with the rest of the group.
  const same = siblings.find((sibling) => comparable(sibling) === comparable(name))
  if (same) return `${groupName.trim() || 'This group'} already has ${quote(same)}.`
  const twin = siblings.find((sibling) => comparable(splitAtEnvironment(sibling).base) === comparable(base) && splitAtEnvironment(sibling).base !== base)
  if (twin) return `Write ${quote(base)} as ${quote(splitAtEnvironment(twin).base)}, the way ${quote(twin)} spells it.`

  return null
}

/** A starting name for an uploaded file: "brand_guidelines-v2.final.pdf" → "Brand guidelines v2 final". */
export function nameFromFile(fileName: string): string {
  const words = fileName
    .replace(/\.[a-z0-9]{1,6}$/i, '')
    .replace(/[_.–—|:]+/g, ' ')
    .replace(/(\S)-(\S)/g, '$1 $2')
    .replace(/[^\p{L}\p{N} &'()+#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return capitalized(words).slice(0, NAME_MAX).trim()
}
