import { downloadFile } from '@/api/files'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'

/** Opens a link in a new tab. A file is downloaded instead (see api/files.ts). */
export function openLink(link: Link) {
  if (link.kind === 'file') downloadFile(link).catch(toastError)
  else window.open(link.url, '_blank', 'noreferrer')
}
