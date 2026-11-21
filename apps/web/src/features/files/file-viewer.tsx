import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, FileQuestion, Pencil, RotateCw, TriangleAlert, X } from 'lucide-react'
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { downloadFile, fetchFileBytes, formatBytes, saveFileText, uploadText } from '@/api/files'
import { groupsOf, useGroupsIfLoaded } from '@/api/groups'
import { useAddLink, useBoardLinksIfLoaded } from '@/api/links'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/app/form'
import { Input } from '@/components/ui/input'
import { FileIcon } from '@/features/board/file-icon'
import { GroupCombobox } from '@/features/links/group-combobox'
import { NAME_MAX, nameError } from '@/features/links/name-rules'
import { useOrg } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { errorMessage, toastError } from '@/lib/errors'
import type { Link, Space } from '@/lib/types'
import { cn } from '@/lib/utils'
import { documentFileName, fileNameFromTitle, isEditable, previewKind, shownType, type DocumentFormat, type PreviewKind } from './file-kind'
import { needsPlainText } from './markdown-safety'

// The editor is the largest part of the app: loaded when a document is first opened.
const MarkdownEditor = lazy(() => import('./markdown-editor'))

/** What the viewer was opened for: a file of the board, or a new document to write. */
type Request = { kind: 'file'; link: Link } | { kind: 'document'; groupName?: string; title?: string }

interface FileViewerApi {
  /** Shows a file inside the app: a picture, a PDF, sound, video, a document or text. Anything else offers its download. */
  openFile: (link: Link) => void
  /** Opens an empty document to write. It is saved as a Markdown file of the open space. */
  newDocument: (start?: { groupName?: string; title?: string }) => void
}

const FileViewerContext = createContext<FileViewerApi | null>(null)

export function useFileViewer() {
  const api = useContext(FileViewerContext)
  if (!api) throw new Error('useFileViewer needs a FileViewerProvider above it.')
  return api
}

/** Holds the one file viewer of the app, so any page can open a file in it. */
export function FileViewerProvider({ children }: { children: ReactNode }) {
  // The count gives every opening a fresh viewer.
  const [request, setRequest] = useState<{ count: number; value: Request } | null>(null)
  const show = useCallback((value: Request) => setRequest((previous) => ({ count: (previous?.count ?? 0) + 1, value })), [])
  const close = useCallback(() => setRequest(null), [])
  const api = useMemo<FileViewerApi>(() => ({ openFile: (link) => show({ kind: 'file', link }), newDocument: (start) => show({ kind: 'document', ...start }) }), [show])

  return (
    <FileViewerContext value={api}>
      {children}
      {request?.value.kind === 'file' && <FileView key={request.count} link={request.value.link} onClose={close} />}
      {request?.value.kind === 'document' && <NewDocument key={request.count} start={request.value} onClose={close} />}
    </FileViewerContext>
  )
}

// ---- The sheet ------------------------------------------------------------------------------

/**
 * The viewer's frame: it covers the app like a page of its own, with a bar at the top (what is
 * open, and what can be done with it) and the file below. Escape and the X ask to close it.
 */
function Sheet({ label, onClose, bar, children }: { label: string; onClose: () => void; bar: ReactNode; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheet.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      before?.focus()
    }
  }, [])

  useEffect(() => {
    // Escape closes the viewer, unless something inside it (a menu of the editor) took the key.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.target instanceof Node && sheet.current?.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div ref={sheet} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="bg-background fixed inset-0 z-40 flex flex-col outline-none motion-safe:animate-card-in">
      <header className="border-line bg-surface flex min-h-[60px] flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onClose} aria-label="Close" className="text-quiet hover:text-ink hover:bg-ink/6 grid size-9 flex-none place-items-center rounded-lg transition-colors">
          <X className="size-5" />
        </button>
        {bar}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  )
}

/** While the editor's code arrives. */
function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the editor" className="flex flex-col gap-3 pt-6">
      {[62, 94, 88, 40, 91, 76].map((width, index) => (
        <span key={index} className={cn('bg-ink/8 animate-pulse rounded-full', index === 0 ? 'mb-2 h-7' : 'h-3.5')} style={{ width: `${width}%` }} />
      ))}
    </div>
  )
}

/** The column a document is read and written in. */
const COLUMN = 'mx-auto w-full max-w-[820px] px-4 sm:px-6'

// ---- A file of the board ----------------------------------------------------------------------

/** What a file's bytes were read as: text (a document, notes, code), or something the browser shows itself. */
type Loaded = { text: string } | { bytes: Blob }

async function load(link: Link, kind: PreviewKind, signal: AbortSignal): Promise<Loaded> {
  const bytes = await fetchFileBytes(link.file_key!, signal)
  if (kind === 'markdown' || kind === 'text') return { text: await bytes.text() }
  // Given to the browser as one of the harmless types its name stands for, whatever it was uploaded as.
  return { bytes: new Blob([bytes], { type: shownType(link.file_name) }) }
}

const fileKey = (key: string | null) => ['file', key] as const

/** Puts a file on the clipboard: its text, or a picture as a PNG, the one kind every browser takes. */
async function copy(file: Loaded) {
  if ('text' in file) return navigator.clipboard.writeText(file.text)
  const picture = await createImageBitmap(file.bytes)
  const canvas = document.createElement('canvas')
  canvas.width = picture.width
  canvas.height = picture.height
  canvas.getContext('2d')!.drawImage(picture, 0, 0)
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!png) throw new Error("The picture couldn't be copied.")
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

function FileView({ link: opened, onClose }: { link: Link; onClose: () => void }) {
  const { isSpaceAdmin } = usePermissions()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const org = useOrg()
  // The link as the board has it now: its size changes when the file is saved.
  const link = useBoardLinksIfLoaded().find((one) => one.id === opened.id) ?? opened
  const kind = previewKind(link)
  const canEdit = isEditable(kind) && isSpaceAdmin(link.space_id)

  const file = useQuery({
    queryKey: fileKey(link.file_key),
    queryFn: ({ signal }) => load(link, kind, signal),
    enabled: kind !== 'none',
    // Read again each time the file is opened: someone else may have saved it.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const text = file.data && 'text' in file.data ? file.data.text : null

  /** The text being edited. Null while the file is only read. */
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // A document with HTML in it is text like any other: the editor is never given any (markdown-safety.ts).
  const plain = useMemo(() => kind === 'markdown' && text !== null && needsPlainText(text), [kind, text])
  const rich = kind === 'markdown' && !plain
  const editing = draft !== null
  const dirty = editing && draft !== text

  const leave = useCallback(
    (then: () => void) => {
      if (!dirty) return then()
      confirm({ title: 'Discard your changes?', description: `${link.title} stays as it was.`, confirmLabel: 'Discard changes', onConfirm: then })
    },
    [dirty, confirm, link.title],
  )
  const close = useCallback(() => leave(onClose), [leave, onClose])

  const save = useCallback(async () => {
    if (draft === null || saving) return
    setSaving(true)
    try {
      await saveFileText(link.file_key!, draft)
      queryClient.setQueryData<Loaded>(fileKey(link.file_key), () => ({ text: draft }))
      setDraft(null)
      toast.success('Saved')
      // The board shows the file's size.
      void queryClient.invalidateQueries({ queryKey: [org.id, 'links'] })
    } catch (error) {
      toast.error("The file couldn't be saved", { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }, [draft, saving, link.file_key, queryClient, org.id])

  // ⌘S or Ctrl+S saves, as in any editor.
  useEffect(() => {
    if (!editing) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (dirty) void save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, dirty, save])

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const ask = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [dirty])

  return (
    <Sheet
      label={link.title}
      onClose={close}
      bar={
        <>
          <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-2.5">
            <FileIcon type={link.file_type} name={link.file_name} className="size-5 [&_svg]:size-5" />
            <div className="min-w-0">
              <h2 className="m-0 truncate text-[16px] leading-tight font-[650] [font-family:var(--font-rounded)]">{link.title}</h2>
              <p className="text-quiet m-0 truncate text-[12.5px]">
                {editing ? (dirty ? 'Editing · not saved yet' : 'Editing') : `${link.file_name} · ${formatBytes(link.file_size ?? 0)}`}
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-none items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="lg" disabled={saving} onClick={() => leave(() => setDraft(null))}>
                  Cancel
                </Button>
                <Button size="lg" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                {canEdit && text !== null && (
                  <Button variant="outline" size="lg" onClick={() => setDraft(text)}>
                    <Pencil />
                    Edit
                  </Button>
                )}
                {file.data && (kind === 'markdown' || kind === 'text' || kind === 'image') && (
                  <Button variant="outline" size="lg" onClick={() => copy(file.data).then(() => toast.success(kind === 'image' ? 'Picture copied' : 'Text copied'), toastError)}>
                    <Copy />
                    Copy
                  </Button>
                )}
                <Button variant={kind === 'none' ? 'default' : 'outline'} size="lg" onClick={() => downloadFile(link).catch(toastError)}>
                  <Download />
                  Download
                </Button>
              </>
            )}
          </div>
        </>
      }
    >
      {kind === 'none' ? (
        <Notice icon={<FileQuestion className="text-quiet size-10" strokeWidth={1.5} />} title="No preview for this file" text={`${link.file_name} can't be shown here. Download it to open it on your computer.`}>
          <Button size="lg" onClick={() => downloadFile(link).catch(toastError)}>
            <Download />
            Download
          </Button>
        </Notice>
      ) : file.isPending ? (
        <div className={COLUMN}>
          <EditorSkeleton />
        </div>
      ) : file.isError ? (
        <Notice icon={<TriangleAlert className="text-danger size-10" strokeWidth={1.5} />} title="This file couldn't be shown" text={errorMessage(file.error)}>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" variant="outline" onClick={() => void file.refetch()}>
              <RotateCw />
              Try again
            </Button>
            <Button size="lg" onClick={() => downloadFile(link).catch(toastError)}>
              <Download />
              Download
            </Button>
          </div>
        </Notice>
      ) : text !== null ? (
        <div className={cn(COLUMN, 'flex min-h-full flex-col py-4')}>
          {plain && <p className="text-quiet border-line mt-0 mb-3 rounded-lg border border-dashed px-3 py-2 text-[13px]">This document has HTML in it, so it is shown as it is written.</p>}
          {rich ? (
            <Suspense fallback={<EditorSkeleton />}>
              {/* A new editor for reading and for editing: it takes its text once, when it starts. */}
              <MarkdownEditor key={editing ? 'edit' : `read:${text.length}`} label={link.title} markdown={editing ? draft : text} readOnly={!editing} autoFocus={editing} onChange={editing ? setDraft : undefined} />
            </Suspense>
          ) : editing ? (
            <textarea
              aria-label={link.title}
              autoFocus
              spellCheck={false}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="border-line bg-surface focus-visible:border-brand/60 min-h-[60dvh] w-full flex-1 resize-none rounded-xl border p-4 font-mono text-[13.5px] leading-relaxed outline-none"
            />
          ) : (
            // Text is drawn as text: whatever it holds (a page's source, a script) can't do anything here.
            <pre className="border-line bg-surface m-0 flex-1 rounded-xl border p-4 font-mono text-[13.5px] leading-relaxed break-words whitespace-pre-wrap">{text || <span className="text-quiet">This file is empty.</span>}</pre>
          )}
        </div>
      ) : file.data && 'bytes' in file.data ? (
        <Shown kind={kind} bytes={file.data.bytes} title={link.title} />
      ) : null}
    </Sheet>
  )
}

/** A picture, a PDF, sound or video, shown by the browser from the file's bytes. */
function Shown({ kind, bytes, title }: { kind: PreviewKind; bytes: Blob; title: string }) {
  // An address for the bytes, which lives as long as this is on screen.
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const address = URL.createObjectURL(bytes)
    // An address has to be made and taken back in step with the bytes: that is what an effect is for.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(address)
    return () => URL.revokeObjectURL(address)
  }, [bytes])
  if (!url) return null

  if (kind === 'pdf') return <iframe title={title} src={url} className="block size-full border-0" />
  return (
    <div className="grid min-h-full place-items-center p-4 sm:p-8">
      {kind === 'image' && <img src={url} alt={title} className="max-h-[calc(100dvh-140px)] max-w-full rounded-lg object-contain shadow-[0_1px_2px_hsl(var(--shadow)/0.1),0_18px_40px_-18px_hsl(var(--shadow)/0.4)]" />}
      {kind === 'video' && <video src={url} controls aria-label={title} className="max-h-[calc(100dvh-140px)] max-w-full rounded-lg bg-black" />}
      {kind === 'audio' && <audio src={url} controls aria-label={title} className="w-full max-w-xl" />}
    </div>
  )
}

function Notice({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icon}
      <h3 className="m-0 mt-2 text-[20px] font-[650] [font-family:var(--font-rounded)]">{title}</h3>
      <p className="text-quiet m-0 leading-relaxed break-words">{text}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

// ---- A new document ---------------------------------------------------------------------------

/**
 * Writing a document in Teamshelf: a name, the group it goes into, and the text. With its
 * formatting it is saved as a Markdown file, without it as plain text. Either way it is a file of
 * the open space like any uploaded one: an admin of the space puts it on the board, anyone else
 * sends it for review.
 */
function NewDocument({ start, onClose }: { start: { groupName?: string; title?: string }; onClose: () => void }) {
  const space = useCurrentSpaceIfLoaded()
  if (!space) return null
  return <DocumentForm space={space} start={start} onClose={onClose} />
}

function DocumentForm({ space, start, onClose }: { space: Space; start: { groupName?: string; title?: string }; onClose: () => void }) {
  const { isSpaceAdmin } = usePermissions()
  const publishes = isSpaceAdmin(space.id)
  const confirm = useConfirm()
  const groups = groupsOf(useGroupsIfLoaded(), space.id)
  const boardLinks = useBoardLinksIfLoaded()
  const addLink = useAddLink()

  const [title, setTitle] = useState(start.title ?? '')
  const [groupName, setGroupName] = useState(start.groupName ?? '')
  const [markdown, setMarkdown] = useState('')
  const [format, setFormat] = useState<DocumentFormat>('md')
  // The file is named after the document, until its author names it themselves.
  const [ownFileName, setOwnFileName] = useState<string | null>(null)
  const fileName = ownFileName ?? fileNameFromTitle(title)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const ids = { title: useId(), group: useId(), file: useId() }

  const group = groups.find((one) => one.name.toLowerCase() === groupName.trim().toLowerCase())
  const siblings = boardLinks.filter((link) => group && link.group_id === group.id).map((link) => link.title)
  const errors = {
    title: nameError(title, { groupName, siblings }),
    group: !groupName.trim() ? 'Choose a group, or type a name to create one.' : groupName.trim().length > 60 ? 'Keep the group name to 60 characters.' : null,
    text: markdown.trim() ? null : 'Write something first.',
  }
  const invalid = Boolean(errors.title || errors.group || errors.text)
  const started = Boolean(title.trim() || markdown.trim())

  const close = () => (started && !saving ? confirm({ title: 'Discard this document?', description: 'Any unsaved content will be permanently lost.', confirmLabel: 'Discard', onConfirm: onClose }) : onClose())

  async function submit() {
    setAttempted(true)
    if (invalid || saving) return
    setSaving(true)
    try {
      const name = title.trim()
      const stored = await uploadText(space.id, documentFileName(fileName, format), markdown)
      await addLink.mutateAsync({
        fields: { spaceId: space.id, group: group ? { id: group.id } : { name: groupName.trim() }, title: name, file: stored },
        publishFor: publishes ? { visibility: 'everyone', memberIds: [] } : undefined,
      })
      toast.success(publishes ? `Added to ${space.name}.` : `Sent for review. The document appears in ${space.name} once an admin approves it.`)
      onClose()
    } catch (error) {
      toastError(error)
      setSaving(false)
    }
  }

  // Closing the tab with something written asks first.
  useEffect(() => {
    if (!started) return
    const ask = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [started])

  const shown = attempted ? errors : { title: title.trim() ? errors.title : null, group: null, text: null }

  function changeFormat(next: DocumentFormat) {
    // Text with tags in it can't go into the formatted editor (markdown-safety.ts).
    if (next === 'md' && needsPlainText(markdown)) return toast.error('This text has HTML in it, so it stays plain text.')
    setFormat(next)
  }

  return (
    <Sheet
      label="New document"
      onClose={close}
      bar={
        <>
          <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-2.5">
            <SpaceLogo space={space} className="size-7 rounded-md" />
            <div className="min-w-0">
              <h2 className="m-0 truncate text-[16px] leading-tight font-[650] [font-family:var(--font-rounded)]">New document</h2>
              <p className="text-quiet m-0 truncate text-[12.5px]">in {space.name}</p>
            </div>
          </div>
          <div className="ml-auto flex flex-none items-center gap-2">
            <Button variant="outline" size="lg" disabled={saving} onClick={close}>
              Cancel
            </Button>
            <Button size="lg" disabled={saving} onClick={() => void submit()}>
              {saving ? 'Saving…' : publishes ? `Add to ${space.name}` : 'Send for review'}
            </Button>
          </div>
        </>
      }
    >
      {/* As tall as the page, so the text has all the room that is left. */}
      <div className={cn(COLUMN, 'flex min-h-full flex-col py-6')}>
        {/* Each field keeps to the top of its column, so a message under one never moves the other. */}
        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid min-w-0 content-start gap-1.5">
            <label htmlFor={ids.title} className="text-[13px] font-medium">
              Name
            </label>
            <Input id={ids.title} autoFocus={!title} autoComplete="off" placeholder="Release checklist" value={title} maxLength={NAME_MAX + 20} aria-invalid={Boolean(shown.title)} onChange={(event) => setTitle(event.target.value)} className="h-10" />
            {shown.title && (
              <span role="alert" className="text-destructive text-[12.5px] leading-snug">
                {shown.title}
              </span>
            )}
          </div>
          <div className="grid min-w-0 content-start gap-1.5">
            <label htmlFor={ids.group} className="text-[13px] font-medium">
              Group
            </label>
            <GroupCombobox id={ids.group} groups={groups} value={groupName} invalid={Boolean(shown.group)} onChange={setGroupName} />
            {shown.group && (
              <span role="alert" className="text-destructive text-[12.5px] leading-snug">
                {shown.group}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Segmented<DocumentFormat>
            label="Save as"
            options={[
              { value: 'md', label: 'Formatted (.md)' },
              { value: 'txt', label: 'Plain text (.txt)' },
            ]}
            value={format}
            onChange={changeFormat}
          />
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor={ids.file} className="text-quiet flex-none text-[13px]">
              File name
            </label>
            <div className="bg-well flex h-9 min-w-0 items-center rounded-md pr-2.5 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--brand)]">
              <input
                id={ids.file}
                autoComplete="off"
                spellCheck={false}
                placeholder="document"
                value={fileName}
                maxLength={80}
                onChange={(event) => setOwnFileName(event.target.value)}
                // Left empty, it follows the document's name again.
                onBlur={() => ownFileName?.trim() === '' && setOwnFileName(null)}
                className="w-48 min-w-0 bg-transparent py-1 pr-1 pl-2.5 text-[13.5px] outline-none"
              />
              {/* As wide for ".md" as for ".txt", so the field keeps its width. */}
              <span className="text-quiet w-7 flex-none text-right text-[13.5px]">.{format}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-1 flex-col">
          {format === 'md' ? (
            <Suspense fallback={<EditorSkeleton />}>
              {/* Started from what was written as plain text, if anything was. */}
              <MarkdownEditor label="Document" markdown={markdown} placeholder="Write your document…" autoFocus={Boolean(title)} onChange={setMarkdown} />
            </Suspense>
          ) : (
            <textarea
              aria-label="Document"
              autoFocus={Boolean(title)}
              spellCheck
              placeholder="Write your text…"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              className="border-line bg-surface focus-visible:border-brand/60 min-h-[40dvh] w-full flex-1 resize-none rounded-xl border p-4 font-mono text-[13.5px] leading-relaxed outline-none"
            />
          )}
          {shown.text && (
            <span role="alert" className="text-destructive text-[12.5px] leading-snug">
              {shown.text}
            </span>
          )}
        </div>
      </div>
    </Sheet>
  )
}
