// Files are kept in Cloudflare R2. The browser never holds the storage keys: it asks the
// server (netlify/functions/files.mjs) for a short-lived address to upload to, or to download
// from, and the server first checks with the database, as the signed-in person, that they may.

import { neon } from '@/lib/neon'
import type { Link } from '@/lib/types'

/** The largest file Linkboard takes. Keep in step with netlify/functions/files.mjs and the database. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export interface StoredFile {
  key: string
  name: string
  size: number
  type: string
}

async function authorization(): Promise<Record<string, string>> {
  const token = (await neon.auth.getSession()).data?.session?.token
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function failure(response: Response, fallback: string) {
  try {
    const answer = (await response.json()) as { error?: string }
    return new Error(answer.error || fallback)
  } catch {
    return new Error(fallback)
  }
}

/** Uploads a file to a space. `onProgress` gets a number from 0 to 1. */
export async function uploadFile(spaceId: string, file: File, onProgress?: (share: number) => void): Promise<StoredFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${formatBytes(MAX_FILE_BYTES)}. This one is ${formatBytes(file.size)}.`)
  if (file.size === 0) throw new Error('This file is empty.')

  const type = file.type || 'application/octet-stream'
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authorization()) },
    body: JSON.stringify({ spaceId, name: file.name, size: file.size, type }),
  })
  if (!response.ok) throw await failure(response, "The file couldn't be uploaded.")
  const { key, uploadUrl } = (await response.json()) as { key: string; uploadUrl: string }

  // XMLHttpRequest, because fetch can't report upload progress.
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('content-type', type)
    request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total)
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`The upload failed (${request.status}). Try again.`)))
    request.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'))
    request.send(file)
  })
  return { key, name: file.name, size: file.size, type }
}

/**
 * The address a file has on the board. It is a page of the app (routes/file.tsx), which signs
 * in and then opens the file, so the address also works when copied or opened in a new tab.
 */
export const fileAddress = (key: string) => `${window.location.origin}/file?key=${encodeURIComponent(key)}`

/** Where the file itself can be read, for a few minutes. */
export async function fileUrl(key: string, download = false): Promise<string> {
  const query = new URLSearchParams({ key, ...(download ? { download: '1' } : {}) })
  const response = await fetch(`/api/files/url?${query}`, { headers: await authorization() })
  if (!response.ok) throw await failure(response, "The file couldn't be opened.")
  return ((await response.json()) as { url: string }).url
}

/**
 * Opens a file in a new tab. The tab is opened at once, in the click, so the browser doesn't
 * block it, and pointed at the file when the server has said where it is.
 */
export async function openFile(link: Pick<Link, 'file_key'>, download = false) {
  const tab = download ? null : window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  try {
    const url = await fileUrl(link.file_key!, download)
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (error) {
    tab?.close()
    throw error
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
