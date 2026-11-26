// Files are kept in Cloudflare R2. The browser never holds the storage keys: it asks the
// server (netlify/lib/files-api.mjs) for a short-lived address to upload to, or to download
// from, and the server first checks with the database, as the signed-in person, that they may.

import { neon } from '@/lib/neon'
import type { Link } from '@/lib/types'

/** The largest file Teamshelf takes. Keep in step with netlify/lib/files-api.mjs and the database. */
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

/** Asks the server where to upload a new file of a space. The database checks that this person may, and counts the upload. */
async function startUpload(spaceId: string, file: { name: string; size: number; type: string }): Promise<{ key: string; uploadUrl: string }> {
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authorization()) },
    body: JSON.stringify({ spaceId, ...file }),
  })
  if (!response.ok) throw await failure(response, "The file couldn't be uploaded.")
  return (await response.json()) as { key: string; uploadUrl: string }
}

/** Uploads a file to a space. `onProgress` gets a number from 0 to 1. */
export async function uploadFile(spaceId: string, file: File, onProgress?: (share: number) => void): Promise<StoredFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${formatBytes(MAX_FILE_BYTES)}. This one is ${formatBytes(file.size)}.`)
  if (file.size === 0) throw new Error('This file is empty.')

  const type = file.type || 'application/octet-stream'
  const { key, uploadUrl } = await startUpload(spaceId, { name: file.name, size: file.size, type })

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

/** Text files are kept as this type, whatever they hold. Storage never serves them as a page (netlify/lib/r2.mjs). */
const TEXT_TYPE = 'text/plain'

/** Writes text to an address the server signed for it. */
async function putText(uploadUrl: string, bytes: Blob) {
  const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': TEXT_TYPE }, body: bytes }).catch(() => null)
  if (!response) throw new Error("The file couldn't be saved. Check your connection and try again.")
  if (!response.ok) throw new Error(`The file couldn't be saved (${response.status}). Try again.`)
}

/** Keeps text written in Teamshelf as a new file of a space (a document: `name` ends in .md). */
export async function uploadText(spaceId: string, name: string, text: string): Promise<StoredFile> {
  const bytes = new Blob([text], { type: TEXT_TYPE })
  if (bytes.size === 0) throw new Error('Write something first.')
  if (bytes.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${formatBytes(MAX_FILE_BYTES)}.`)
  const { key, uploadUrl } = await startUpload(spaceId, { name, size: bytes.size, type: TEXT_TYPE })
  await putText(uploadUrl, bytes)
  return { key, name, size: bytes.size, type: TEXT_TYPE }
}

/** Writes new text over a file, for the admins of its space. Returns the file's new size. */
export async function saveFileText(key: string, text: string): Promise<number> {
  const bytes = new Blob([text], { type: TEXT_TYPE })
  if (bytes.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${formatBytes(MAX_FILE_BYTES)}.`)
  const response = await fetch('/api/files/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authorization()) },
    body: JSON.stringify({ key, size: bytes.size, type: TEXT_TYPE }),
  })
  if (!response.ok) throw await failure(response, "The file couldn't be saved.")
  await putText(((await response.json()) as { uploadUrl: string }).uploadUrl, bytes)
  return bytes.size
}

/**
 * A file's bytes, to show it inside the app. They come as plain bytes (the storage never says
 * otherwise): what they are shown as is decided here, by the file's name (features/files/file-kind.ts).
 */
export async function fetchFileBytes(key: string, signal?: AbortSignal): Promise<Blob> {
  const url = await fileUrl(key, 'show')
  const response = await fetch(url, { signal }).catch((error: unknown) => {
    if (signal?.aborted) throw error
    return null
  })
  if (!response) throw new Error("The file couldn't be loaded. Check your connection and try again.")
  if (!response.ok) throw new Error(`The file couldn't be loaded (${response.status}).`)
  return response.blob()
}

/**
 * The address a file has on the board. It is a page of the app (routes/file.tsx), which signs
 * in and then downloads the file, so the address also works when copied or opened in a new tab.
 */
export const fileAddress = (key: string) => `${window.location.origin}/file?key=${encodeURIComponent(key)}`

/**
 * Where the file itself is, for a few minutes: to save it to disk ('download'), to read its bytes
 * and show them in the app ('show'), or to give to a frame ('frame'). Only a PDF gets a frame:
 * the server decides by the file's name and refuses any other (netlify/lib/file-serving.mjs).
 * 'download' and 'show' are the same to the server; mock mode answers each in its own way.
 */
export async function fileUrl(key: string, purpose: 'download' | 'show' | 'frame' = 'download'): Promise<string> {
  const response = await fetch(`/api/files/url?${new URLSearchParams({ key, for: purpose })}`, { headers: await authorization() })
  if (!response.ok) throw await failure(response, "The file couldn't be opened.")
  return ((await response.json()) as { url: string }).url
}

/**
 * Starts the browser's download of the file at this address. The page stays where it is. The
 * storage names the file itself (netlify/lib/r2.mjs); `name` is for an address that doesn't.
 */
export function startDownload(url: string, name = '') {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/** Downloads a file. Files are always saved to disk, never shown in a tab (netlify/lib/r2.mjs). */
export async function downloadFile(link: Pick<Link, 'file_key' | 'file_name'>) {
  startDownload(await fileUrl(link.file_key!), link.file_name ?? '')
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
