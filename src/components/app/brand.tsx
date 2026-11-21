import '@fontsource/space-grotesk/700.css'
import { cn } from '@/lib/utils'

/**
 * Teamshelf's mark: the t and the s of team/shelf with the orange slash between them, on a dark
 * tile. The letters are Space Grotesk, drawn as shapes so they need no font.
 * With `loading` the slash breathes. public/favicon.svg is the same drawing.
 */
export function BrandMark({ className, loading = false }: { className?: string; loading?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-[26px]', className)}>
      <rect width="64" height="64" rx="14" fill="#14151c" />
      <path d="M22.85 43L18.09 43Q16.42 43 15.38 41.96Q14.35 40.93 14.35 39.19L14.35 39.19L14.35 29.67L10.13 29.67L10.13 26.14L14.35 26.14L14.35 20.90L18.63 20.90L18.63 26.14L23.26 26.14L23.26 29.67L18.63 29.67L18.63 38.44Q18.63 39.46 19.58 39.46L19.58 39.46L22.85 39.46L22.85 43Z" fill="#fff" />
      <path className={cn(loading && 'motion-safe:animate-splash')} d="M36 17 28 49" stroke="#fa8c29" strokeWidth="5" strokeLinecap="round" />
      <path d="M47.48 43.48L47.48 43.48Q44.18 43.48 42.07 42.05Q39.96 40.62 39.52 37.97L39.52 37.97L43.46 36.95Q43.70 38.14 44.26 38.82Q44.82 39.50 45.66 39.79Q46.49 40.08 47.48 40.08L47.48 40.08Q48.97 40.08 49.69 39.55Q50.40 39.02 50.40 38.24L50.40 38.24Q50.40 37.46 49.72 37.03Q49.04 36.61 47.54 36.34L47.54 36.34L46.59 36.17Q44.82 35.83 43.36 35.23Q41.90 34.64 41.02 33.58Q40.13 32.53 40.13 30.86L40.13 30.86Q40.13 28.35 41.97 27.00Q43.80 25.66 46.80 25.66L46.80 25.66Q49.62 25.66 51.49 26.92Q53.36 28.18 53.94 30.22L53.94 30.22L49.96 31.44Q49.69 30.15 48.85 29.60Q48.02 29.06 46.80 29.06L46.80 29.06Q45.57 29.06 44.93 29.48Q44.28 29.91 44.28 30.66L44.28 30.66Q44.28 31.47 44.96 31.86Q45.64 32.26 46.80 32.46L46.80 32.46L47.75 32.63Q49.65 32.97 51.20 33.53Q52.75 34.09 53.65 35.13Q54.55 36.17 54.55 37.93L54.55 37.93Q54.55 40.59 52.63 42.03Q50.71 43.48 47.48 43.48Z" fill="#fff" />
    </svg>
  )
}

/** The name as the logo: team/shelf in Space Grotesk, with the slash in the brand orange. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Teamshelf" className={cn('inline-block text-[30px] leading-none font-bold tracking-[-0.045em] whitespace-nowrap [font-family:\'Space_Grotesk\',ui-sans-serif,system-ui]', className)}>
      <span aria-hidden="true">
        team<span className="text-[#fa8c29]">/</span>shelf
      </span>
    </span>
  )
}
