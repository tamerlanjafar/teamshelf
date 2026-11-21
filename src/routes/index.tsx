import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/features/landing/landing-page'
import { shot } from '@/features/landing/shots'
import { OG_IMAGE, pageHead, SITE_NAME, SITE_URL, TAGLINE } from '@/lib/site'

const TITLE = "Teamshelf: your team's links and files, in one place"
const DESCRIPTION =
  'Teamshelf gives each team a space for its tools, docs and files. Find any link in a keystroke, suggest new ones, and keep private spaces for the people who need them. Sign in by email, no passwords.'

/**
 * What search engines read about Teamshelf besides the page: the site, and the product, as
 * structured data (schema.org).
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME, description: TAGLINE, inLanguage: 'en' },
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png` },
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: DESCRIPTION,
      image: OG_IMAGE,
      publisher: { '@id': `${SITE_URL}/#organization` },
      featureList: [
        'A space for each team, open to everyone or private',
        'Quick find: search every link and file with /',
        'Suggestions that admins of a space approve',
        'Links visible to everyone, to admins, or to chosen people',
        'Files up to 25 MB next to your links',
        'Several organizations, each with its own email',
        'Sign in by email link, no passwords',
      ],
    },
  ],
}

/** teamshelf.app: the front page, for everyone. The app itself opens from it (/open). */
export const Route = createFileRoute('/')({
  head: () => {
    const head = pageHead({ path: '/', title: TITLE, description: DESCRIPTION })
    return {
      ...head,
      // The largest picture, asked for before anything else: the one for the system's theme, at a size that fits.
      links: [
        ...head.links,
        { rel: 'preload', as: 'image', type: 'image/avif', href: shot('board-light-phone.avif'), media: '(max-width: 639px) and (prefers-color-scheme: light)', fetchPriority: 'high' },
        { rel: 'preload', as: 'image', type: 'image/avif', href: shot('board-dark-phone.avif'), media: '(max-width: 639px) and (prefers-color-scheme: dark)', fetchPriority: 'high' },
        { rel: 'preload', as: 'image', type: 'image/avif', imageSrcSet: `${shot('board-light-1200.avif')} 1200w, ${shot('board-light-2240.avif')} 2240w`, imageSizes: '(min-width: 1200px) 1130px, calc(100vw - 48px)', media: '(min-width: 640px) and (prefers-color-scheme: light)', fetchPriority: 'high' },
        { rel: 'preload', as: 'image', type: 'image/avif', imageSrcSet: `${shot('board-dark-1200.avif')} 1200w, ${shot('board-dark-2240.avif')} 2240w`, imageSizes: '(min-width: 1200px) 1130px, calc(100vw - 48px)', media: '(min-width: 640px) and (prefers-color-scheme: dark)', fetchPriority: 'high' },
      ],
      scripts: [{ type: 'application/ld+json', children: JSON.stringify(STRUCTURED_DATA) }],
    }
  },
  component: LandingPage,
})
