// Where a site's icon might be. The page itself can't be read from here (the browser doesn't
// allow it across sites), so instead of looking up the icon the page declares, the usual
// places are tried one after another until an image loads.

/** Places relative to the folder of the linked page, for tools that keep their icon next to it. */
const BESIDE_THE_PAGE = [
  'favicon.ico',
  'favicon-32x32.png',
  'favicon.png',
  // Swagger UI, in its common setups.
  'webjars/springfox-swagger-ui/favicon-32x32.png',
  'swagger-ui/favicon-32x32.png',
  'webjars/swagger-ui/favicon-32x32.png',
]

/** The addresses to try for a link's icon, most likely first. Empty when the address isn't a web address. */
export function iconCandidates(url: string): string[] {
  try {
    const page = new URL(url)
    const folder = new URL('.', page).href
    const candidates = [`${page.origin}/favicon.ico`, ...BESIDE_THE_PAGE.map((path) => folder + path), `${page.origin}/apple-touch-icon.png`]
    return [...new Set(candidates)]
  } catch {
    return []
  }
}

// What was found is remembered in this browser, so the misses aren't asked for on every visit.

const KEY = 'linkboard-icons'
const NONE = ''
const KEEP_FOR = 7 * 24 * 60 * 60 * 1000

type Remembered = Record<string, { icon: string; at: number }>

function readAll(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Remembered
  } catch {
    return {}
  }
}

/** The icons of a site live with the folder of the page, so links to the same tool share the answer. */
const placeOf = (url: string) => {
  try {
    return new URL('.', url).href
  } catch {
    return url
  }
}

/** The icon found earlier for this link: its address, null for "it has none", undefined for "not known yet". */
export function rememberedIcon(url: string): string | null | undefined {
  const entry = readAll()[placeOf(url)]
  if (!entry || Date.now() - entry.at > KEEP_FOR) return undefined
  return entry.icon === NONE ? null : entry.icon
}

export function rememberIcon(url: string, icon: string | null) {
  try {
    const all = readAll()
    all[placeOf(url)] = { icon: icon ?? NONE, at: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Without storage the places are simply tried again next time.
  }
}
