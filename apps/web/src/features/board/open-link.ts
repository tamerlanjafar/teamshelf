import type { Link } from '@/lib/types'

/** Opens a link in a new tab. A file is shown in the app instead (features/files/file-viewer.tsx). */
export function openLink(link: Link, openFile: (link: Link) => void) {
  if (link.kind === 'file') openFile(link)
  else window.open(link.url, '_blank', 'noreferrer')
}
