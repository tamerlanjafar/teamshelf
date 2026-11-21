import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { watchAppVersion } from '@/lib/app-version'
import { queryClient } from '@/lib/query-client'
import { OG_IMAGE, SITE_NAME, TAGLINE } from '@/lib/site'
import { useTheme } from '@/lib/theme'
import '@/index.css'

/**
 * Before the first paint: the theme (src/lib/theme.ts keeps it up to date afterwards), and a
 * `js` class, so parts that rise into view as you scroll start out of sight only when the page
 * can bring them back (src/features/landing/motion.tsx).
 */
const BEFORE_PAINT = `try {
  var root = document.documentElement
  root.classList.add('js')
  var choice = localStorage.getItem('teamshelf-theme')
  var dark = choice === 'dark' || (choice !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
} catch (error) {}`

export const Route = createRootRoute({
  // What every page starts from. Each page adds its own title and description (src/lib/site.ts).
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_NAME },
      { name: 'description', content: TAGLINE },
      { name: 'theme-color', content: '#f2f3f7', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#0d0e13', media: '(prefers-color-scheme: dark)' },
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: `team/shelf: ${TAGLINE.toLowerCase()}` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: Document,
  component: Root,
})

/** The page itself: the head, and the scripts that bring it to life. */
function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {__MOCK_TAB_SCRIPT__ && <script dangerouslySetInnerHTML={{ __html: __MOCK_TAB_SCRIPT__ }} />}
        <script dangerouslySetInnerHTML={{ __html: BEFORE_PAINT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Root() {
  const theme = useTheme()
  useEffect(() => {
    watchAppVersion()
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={400}>
        <Outlet />
        <Toaster theme={theme} position="bottom-center" toastOptions={{ style: { borderRadius: 12 } }} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
