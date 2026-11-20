import { useState } from 'react'
import { iconCandidates, rememberedIcon, rememberIcon } from './favicon-source'
import './link-parts.css'

/**
 * The site's own icon, loaded straight from the site. Many links are internal, so their
 * addresses are never sent to an icon service. First the icon found when the link was saved
 * (`iconUrl`), then the usual places for one, in turn. Until one has loaded, and when there is none, the first letter of the link's name
 * stands in for it.
 */
export function Favicon({ url, iconUrl, title }: { url: string; iconUrl?: string | null; title: string }) {
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
    <span className={loaded ? 'favicon' : 'favicon letter'} aria-hidden="true">
      {!loaded && (title.trim()[0]?.toUpperCase() ?? '?')}
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
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
