// The rules a link's name follows. A name that breaks one can't be saved, by anyone: the form
// shows the first broken rule under the name, and the database checks the same rules again
// (app.link_name_error in db/migrations/000_baseline.sql), except the two that
// compare a name with the other links of its group.
//
// The aim: every card reads the same way. The thing spelled like its siblings spell it, extra
// detail in brackets ("Payments API (v2)"), no decoration. A name may start with its group's
// name ("Project Board" in Project): that is the person's choice.

export const NAME_MAX = 60

/** Names that say nothing about what the link opens. */
const GENERIC = ['link', 'links', 'website', 'site', 'url', 'page', 'here', 'home', 'new link', 'untitled', 'click here', 'open', 'app']

export interface NameContext {
  /** The group the link is in, or the name of a new one. */
  groupName: string
  /** The names of the other links in that group. */
  siblings: string[]
}

const quote = (text: string) => `“${text}”`
const comparable = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')
const capitalized = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)

/** The name without the detail in brackets at its end: "Payments API (v2)" → "Payments API". */
const baseOf = (name: string) => name.replace(/\s*\([^()]*\)$/, '').trim() || name.trim()

/** "Payments API - v2" → "Payments API (v2)": the way to write a detail after a dash. */
const bracketed = (name: string) => name.replace(/\s*[-–—|:]\s*([^-–—|:]+)$/, ' ($1)').replace(/\s+/g, ' ').trim()

/** The first rule this name breaks, as the sentence shown under the field. Null for a good name. */
export function nameError(typed: string, { groupName, siblings }: NameContext): string | null {
  const name = typed.trim()

  if (!name) return 'Give the link a name.'
  if (name.length < 2) return 'A name needs at least 2 characters.'
  if (name.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters. This one has ${name.length}.`

  if (/:\/\/|^www\./i.test(name) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(name)) {
    return 'This is an address, not a name. Write what the link opens, like “Team wiki” or “Release notes”.'
  }

  // A dash, bar or colon between parts: the detail goes in brackets instead.
  if (/\s[-–—|:]|[–—|:]\s|[–—|:]/.test(name)) {
    const mark = /\s-|-\s/.test(name) ? '-' : /[–—|:]/.exec(name)![0]
    return `Remove ${quote(mark)}. Put extra detail in brackets: ${quote(bracketed(name))}.`
  }
  if (/_/.test(name)) return 'Remove “_”. Use spaces between words.'

  const odd = [...name].find((character) => !/[\p{L}\p{N} .&'()/+#,-]/u.test(character))
  if (odd) return `Remove ${quote(odd)}. Names use letters, digits, spaces and . , & ' ( ) / + # -`

  if (/\s{2,}/.test(name)) return 'Use one space between words.'
  if (/[.,/&+-]$/.test(name)) return `Remove the ${quote(name.at(-1)!)} at the end.`
  if (/^[^\p{L}\p{N}(]/u.test(name)) return 'Start the name with a letter or a digit.'
  if ((name.match(/\(/g) ?? []).length !== (name.match(/\)/g) ?? []).length) return 'Close the bracket, or remove it.'
  if (GENERIC.includes(comparable(name))) return `${quote(name)} doesn't say what the link opens. Name the tool or the page, like “Team wiki” or “Release notes”.`

  // Capitals.
  const first = name.split(/[\s(]+/).filter(Boolean)[0]
  if (/^\p{Ll}+$/u.test(first.replace(/[-'.]/g, ''))) return `Start with a capital letter: ${quote(capitalized(name))}.`
  const shouted = name.split(/[\s()/-]+/).find((word) => /^\p{Lu}{6,}$/u.test(word))
  if (shouted) return `Write ${quote(shouted)} as ${quote(shouted[0] + shouted.slice(1).toLowerCase())}. Capitals are for abbreviations of up to 5 letters, like API or SSO.`

  // Agree with the rest of the group.
  const same = siblings.find((sibling) => comparable(sibling) === comparable(name))
  if (same) return `${groupName.trim() || 'This group'} already has ${quote(same)}.`
  const base = baseOf(name)
  const twin = siblings.find((sibling) => comparable(baseOf(sibling)) === comparable(base) && baseOf(sibling) !== base)
  if (twin) return `Write ${quote(base)} as ${quote(baseOf(twin))}, the way ${quote(twin)} spells it.`

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
