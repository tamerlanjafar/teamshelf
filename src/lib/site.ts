// What the site says about itself, for the page titles, search results and link previews.

/** The public address, for canonical links, link previews, the sitemap and robots.txt. */
export const SITE_URL = 'https://teamshelf.app'

export const SITE_NAME = 'Teamshelf'

/** The line under the name, wherever the site describes itself in a sentence. */
export const TAGLINE = "Your team's links and files, in one place."

/** The picture link previews show (public/og.png, 1200 × 630). */
export const OG_IMAGE = `${SITE_URL}/og.png`

/**
 * The tags a public page needs to read well in search results and link previews: its title and
 * description, the address search engines should list it under, and the preview card.
 */
export function pageHead({ path, title, description }: { path: string; title: string; description: string }) {
  const url = `${SITE_URL}${path}`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

/** For the app's own pages: no search listing, and the plain name as the title. */
export const privateHead = (title = SITE_NAME) => ({ meta: [{ title }, { name: 'robots', content: 'noindex, nofollow' }] })
