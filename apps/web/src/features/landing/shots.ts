// The front page's screenshots (taken from mock mode, in both themes), as files of the build:
// each one's name carries a hash of its content, so it can be cached for good, and a new
// screenshot is a new address that nobody has an old copy of (netlify.toml caches /assets/*).
const FILES = import.meta.glob<string>('./shots/*.{avif,webp}', { eager: true, query: '?url', import: 'default' })

/** The address of a screenshot, by its file name in ./shots ("board-dark-1200.avif"). */
export function shot(file: string): string {
  const url = FILES[`./shots/${file}`]
  if (!url) throw new Error(`No screenshot named ${file}`)
  return url
}
