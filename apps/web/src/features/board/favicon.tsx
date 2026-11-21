import { useState } from 'react'
import { iconCandidates, rememberedIcon, rememberIcon } from './favicon-source'
import { cn } from '@/lib/utils'

/**
 * The site's own icon, loaded straight from the site. Many links are internal, so their
 * addresses are never sent to an icon service. First the icon found when the link was saved
 * (`iconUrl`), then the usual places for one, in turn. Until one has loaded, and when there is none, the first letter of the link's name
 * stands in for it.
 */
export function Favicon({ url, iconUrl, title, className }: { url: string; iconUrl?: string | null; title: string; className?: string }) {
  // The places still to try. A place found earlier is the only one, a known "none" leaves nothing.
  const [candidates, setCandidates] = useState(() => {
    // The icon found when the link was saved comes first. If it doesn't load, the usual places follow.
    if (iconUrl) return [...new Set([iconUrl, ...iconCandidates(url)])]
    const remembered = rememberedIcon(url)
    return remembered === undefined ? iconCandidates(url) : remembered === null ? [] : [remembered]
  })
  const [loaded, setLoaded] = useState(false)
  const [src] = candidates

  function tryNext() {
    const rest = candidates.slice(1)
    if (rest.length === 0) rememberIcon(url, null)
    setCandidates(rest)
  }

  return (
    // "favicon" names it for the places that size it differently (the review queue). Inside a
    // card the letter takes the card's color (--c).
    <span
      className={cn(
        'favicon relative size-4 flex-none overflow-hidden rounded-[4px]',
        !loaded && 'grid place-items-center bg-[color-mix(in_srgb,var(--c,var(--quiet))_80%,var(--ink))] [font:700_10px/1_var(--font-rounded)] text-white',
        className,
      )}
      aria-hidden="true"
    >
      {!loaded && (title.trim()[0]?.toUpperCase() ?? '?')}
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          // Invisible over the letter until it has loaded.
          className={cn('absolute inset-0 size-full', !loaded && 'opacity-0')}
          onLoad={() => {
            setLoaded(true)
            rememberIcon(url, src)
          }}
          onError={tryNext}
        />
      )}
    </span>
  )
}
