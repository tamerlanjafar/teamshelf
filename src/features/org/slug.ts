/** Addresses that are pages of the app itself, so no organization can have them. The database refuses them too. */
const RESERVED = ['login', 'signup', 'open', 'new', 'join', 'assets', 'api', 'settings', 'organizations', 'file']

/** An address made from a name: "Acme Corp!" → "acme-corp". */
export const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

/** What is wrong with an address, or nothing. */
export function slugProblem(slug: string): string | undefined {
  if (slug.length < 2) return 'Use at least 2 characters.'
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) return 'Use lower-case letters, numbers and dashes, starting and ending with a letter or number.'
  if (RESERVED.includes(slug)) return 'That address is used by Teamshelf itself.'
  return undefined
}
