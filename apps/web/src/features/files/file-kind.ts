// What Teamshelf can show of a file, and what it can edit. Pure functions, no React.
//
// A file is shown inside the app, never opened as a page of its own: its bytes are fetched and
// handed to the browser as one of the harmless kinds below (a picture, a PDF, sound, video), or
// drawn as text. What kind it is comes from its name, never from the type its uploader claimed,
// and a web page or a script is only ever text.

export type PreviewKind = 'image' | 'pdf' | 'audio' | 'video' | 'markdown' | 'text' | 'none'

/** The types a file's bytes may be given to the browser as, by the ending of its name. Nothing that can run a script. */
const SHOWN_AS: Record<string, { kind: PreviewKind; type: string }> = {
  png: { kind: 'image', type: 'image/png' },
  jpg: { kind: 'image', type: 'image/jpeg' },
  jpeg: { kind: 'image', type: 'image/jpeg' },
  gif: { kind: 'image', type: 'image/gif' },
  webp: { kind: 'image', type: 'image/webp' },
  avif: { kind: 'image', type: 'image/avif' },
  bmp: { kind: 'image', type: 'image/bmp' },
  ico: { kind: 'image', type: 'image/x-icon' },
  pdf: { kind: 'pdf', type: 'application/pdf' },
  mp3: { kind: 'audio', type: 'audio/mpeg' },
  wav: { kind: 'audio', type: 'audio/wav' },
  ogg: { kind: 'audio', type: 'audio/ogg' },
  m4a: { kind: 'audio', type: 'audio/mp4' },
  flac: { kind: 'audio', type: 'audio/flac' },
  mp4: { kind: 'video', type: 'video/mp4' },
  webm: { kind: 'video', type: 'video/webm' },
  mov: { kind: 'video', type: 'video/quicktime' },
  md: { kind: 'markdown', type: 'text/plain' },
  markdown: { kind: 'markdown', type: 'text/plain' },
}

/**
 * Files that are text, read and edited as it is written: notes, data, settings, code. A web
 * page (.html) or a drawing made of markup (.svg) is among them on purpose: here it is its
 * source, which can't do anything.
 */
const TEXT = new Set([
  'txt', 'text', 'log', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'xml', 'html', 'htm', 'svg', 'css', 'scss',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'proto', 'tf', 'gradle', 'properties', 'rst', 'tex', 'diff', 'patch',
])

/** Text is read whole into the page, so only up to this size. A longer file is downloaded instead. */
export const MAX_TEXT_BYTES = 1024 * 1024

/** The ending of a file's name, in small letters: "Plan.FINAL.PDF" → "pdf". Empty when it has none. */
export function extensionOf(name: string | null | undefined): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec((name ?? '').trim())
  return match ? match[1].toLowerCase() : ''
}

/** How a file is shown. "none": it can only be downloaded. */
export function previewKind(file: { file_name: string | null; file_size: number | null }): PreviewKind {
  const extension = extensionOf(file.file_name)
  const known = SHOWN_AS[extension]?.kind ?? (TEXT.has(extension) ? 'text' : 'none')
  if ((known === 'markdown' || known === 'text') && (file.file_size ?? 0) > MAX_TEXT_BYTES) return 'none'
  return known
}

/** The type a file's bytes are given to the browser as: one of the harmless ones, or plain bytes. */
export const shownType = (name: string | null | undefined): string => SHOWN_AS[extensionOf(name)]?.type ?? 'application/octet-stream'

/** Whether Teamshelf can change the file: text, and Markdown with its formatting. */
export const isEditable = (kind: PreviewKind) => kind === 'markdown' || kind === 'text'

/** What a document written in Teamshelf is saved as: Markdown, with its formatting, or plain text. */
export type DocumentFormat = 'md' | 'txt'

/** The name a document's file gets from the document's own name, without its ending: "Release plan (Q3)" → "release-plan-q3". */
export function fileNameFromTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80)
}

/**
 * The file a document is saved as: the name its author gave the file (or "document"), cleaned
 * of what a file name can't have, with the ending of its format. An ending typed by hand is
 * taken off first, so the format always decides.
 */
export function documentFileName(typed: string, format: DocumentFormat = 'md'): string {
  const base = typed
    .trim()
    .replace(/\.(md|markdown|txt)$/i, '')
    .replace(/[^\p{L}\p{N} ._-]+/gu, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 80)
  return `${base || 'document'}.${format}`
}

/**
 * An address for a link in a document, or null when it isn't one a document may point to. Only
 * web and mail addresses: never "javascript:" and the like.
 */
export function safeHref(address: string): string | null {
  const text = address.trim()
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : null
  } catch {
    return null
  }
}
