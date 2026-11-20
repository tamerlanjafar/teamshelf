import { openFile } from '@/api/files'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'

/** Opens a link in a new tab. A file is asked for first (see api/files.ts), the rest open as they are. */
export function openLink(link: Link) {
  if (link.kind === 'file') openFile(link).catch(toastError)
  else window.open(link.url, '_blank', 'noreferrer')
}
