import { useState } from 'react'
import './link-parts.css'

function iconUrl(url: string) {
  try {
    return `${new URL(url).origin}/favicon.ico`
  } catch {
    return null
  }
}

/**
 * The site's own icon, loaded straight from the site. Many links are internal, so their
 * addresses are never sent to an icon service. Until the icon has loaded, and when there
 * is none, the first letter of the link's name stands in for it.
 */
export function Favicon({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = iconUrl(url)

  return (
    <span className={loaded ? 'favicon' : 'favicon letter'} aria-hidden="true">
      {!loaded && (title.trim()[0]?.toUpperCase() ?? '?')}
      {src && !failed && <img src={src} alt="" loading="lazy" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    </span>
  )
}
