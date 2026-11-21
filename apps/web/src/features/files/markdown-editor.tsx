import { Image } from '@tiptap/extension-image'
import { Paragraph } from '@tiptap/extension-paragraph'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
} from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { safeHref } from './file-kind'

/** An address as typed into the link box, made whole: "example.com" → "https://example.com/". Null when it isn't a web or mail address. */
const typedAddress = (typed: string) => {
  const text = typed.trim()
  return safeHref(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
}

/** Only pictures on the web: never one carried in the address itself, or of another kind of address. */
const webPicture = (address: unknown) => (typeof address === 'string' && /^https?:\/\//i.test(address.trim()) ? safeHref(address) : null)

/**
 * A picture in a document. It lives on someone else's site, so it isn't fetched when the
 * document opens: that would tell that site who opened the document, and when. The reader sees
 * where it is from, and loads it with a click. Until then nothing drawn for it carries a `src`.
 */
const Pictures = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src]' }, { tag: 'div[data-picture]', getAttrs: (node) => ({ src: node.getAttribute('data-picture'), alt: node.getAttribute('data-alt') }) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-picture': String(node.attrs.src ?? ''), 'data-alt': String(node.attrs.alt ?? '') }]
  },
  addNodeView() {
    return ({ node }) => {
      const address = webPicture(node.attrs.src)
      const alt = typeof node.attrs.alt === 'string' && node.attrs.alt ? node.attrs.alt : 'Picture'
      const dom = document.createElement('div')
      dom.className = 'doc-picture'
      dom.contentEditable = 'false'
      // Written as text, never as markup: a name or an address can't become part of the page.
      const where = document.createElement('span')
      where.textContent = address ? `${alt} · ${new URL(address).host}` : `${alt} · can't be shown`
      dom.append(where)
      if (address) {
        const show = document.createElement('button')
        show.type = 'button'
        show.textContent = 'Show picture'
        show.addEventListener('click', () => {
          const picture = document.createElement('img')
          picture.alt = alt
          picture.referrerPolicy = 'no-referrer'
          picture.draggable = false
          picture.src = address
          dom.classList.add('doc-picture-shown')
          dom.replaceChildren(picture)
        })
        dom.append(show)
      }
      return { dom, ignoreMutation: () => true, stopEvent: (event) => event.target instanceof HTMLButtonElement }
    }
  },
}).configure({ allowBase64: false })

/**
 * A line of text that starts like Markdown ("# not a heading", "- not a list", "1. not a step")
 * is written with a backslash in front, so it is still that line of text when the document is
 * opened again. Formatting comes from the toolbar, not from what a line starts with.
 */
const Paragraphs = Paragraph.extend({
  renderMarkdown(node, helpers, context) {
    const written = this.parent?.(node, helpers, context) ?? ''
    return written.replace(/^(\s*)(#{1,6}(?=\s|$)|>|[-+*](?=\s)|\d+[.)](?=\s))/gm, (_, indent: string, sign: string) =>
      /^\d/.test(sign) ? `${indent}${sign.slice(0, -1)}\\${sign.slice(-1)}` : `${indent}\\${sign}`,
    )
  },
})

/**
 * A document, written and read with its formatting: headings, lists and checklists, quotes,
 * links, tables, code, pictures by address. It is Markdown underneath, which is what is saved.
 *
 * It is only ever given Markdown without HTML in it (markdown-safety.ts decides, before this is
 * drawn), and it draws from the document's structure, so nothing in a document can run. A link
 * only points to the web or to mail, opens in a new tab without saying where it came from, and a
 * picture is fetched only when asked for. `readOnly` shows it for reading, without the toolbar.
 *
 * Loaded only when a document is opened (see file-viewer.tsx).
 */
export default function MarkdownEditor({
  markdown,
  readOnly = false,
  placeholder,
  autoFocus = false,
  label,
  onChange,
}: {
  markdown: string
  readOnly?: boolean
  placeholder?: string
  autoFocus?: boolean
  /** What the text is, for screen readers. */
  label: string
  onChange?: (markdown: string) => void
}) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Markdown has no underline: it would be saved as a tag.
        underline: false,
        paragraph: false,
        heading: { levels: [1, 2, 3, 4] },
        link: {
          // Reading: a click opens the link. Writing: a click puts the caret in it.
          openOnClick: readOnly,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
          protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (address) => safeHref(address) !== null,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow', referrerpolicy: 'no-referrer' },
        },
      }),
      Paragraphs,
      TaskList,
      TaskItem.configure({ nested: true, a11y: { checkboxLabel: (node) => node.textContent || 'Task' } }),
      TableKit.configure({ table: { resizable: false } }),
      Pictures,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Markdown,
    ],
    [readOnly, placeholder],
  )

  const untouched = useRef<string | null>(null)
  const editor = useEditor({
    extensions,
    content: markdown,
    contentType: 'markdown',
    editable: !readOnly,
    // Formatting comes from the toolbar and the keyboard shortcuts. Typing "#" or "-" stays what was typed.
    enableInputRules: false,
    autofocus: autoFocus ? 'start' : false,
    editorProps: {
      attributes: { class: 'doc-prose', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, ...(readOnly ? { 'aria-readonly': 'true' } : {}) },
    },
    // The editor writes Markdown its own way (a table's columns lined up, a bare address as a
    // link), and tidies the document once when it opens. What it makes of the document as it came
    // is remembered after that, so only what the person does counts as a change, and a change
    // that is taken back gives the document's own text again.
    onCreate: ({ editor: current }) => {
      setTimeout(() => {
        if (!current.isDestroyed) untouched.current = current.getMarkdown()
      })
    },
    onUpdate: ({ editor: current }) => {
      if (readOnly || untouched.current === null) return
      const next = current.getMarkdown()
      onChange?.(next === untouched.current ? markdown : next)
    },
  })

  return (
    <div className="doc-editor min-w-0">
      {!readOnly && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// ---- The toolbar ------------------------------------------------------------------------------

const TOOL = 'text-quiet hover:text-ink hover:bg-ink/6 grid h-8 min-w-8 flex-none place-items-center rounded-md px-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-[color-mix(in_srgb,var(--brand)_13%,transparent)] aria-pressed:text-brand [&_svg]:size-[17px]'

/** One button of the toolbar: what it does is its tooltip, and its name for screen readers. */
function Tool({ label, shortcut, active, disabled, onClick, children }: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            // The caret stays in the document: a button of the toolbar never takes it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={TOOL}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

const Divider = () => <span aria-hidden="true" className="bg-line mx-1 h-5 w-px flex-none" />

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

const BLOCKS = [
  { id: 'paragraph', label: 'Text', icon: Pilcrow },
  { id: 'h1', label: 'Heading 1', icon: Heading1 },
  { id: 'h2', label: 'Heading 2', icon: Heading2 },
  { id: 'h3', label: 'Heading 3', icon: Heading3 },
] as const

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      bullets: current.isActive('bulletList'),
      numbers: current.isActive('orderedList'),
      tasks: current.isActive('taskList'),
      quote: current.isActive('blockquote'),
      codeBlock: current.isActive('codeBlock'),
      link: current.isActive('link'),
      href: (current.getAttributes('link').href as string | undefined) ?? '',
      table: current.isActive('table'),
      block: current.isActive('heading', { level: 1 }) ? 'h1' : current.isActive('heading', { level: 2 }) ? 'h2' : current.isActive('heading', { level: 3 }) ? 'h3' : 'paragraph',
      undo: current.can().undo(),
      redo: current.can().redo(),
    }),
  })
  const [linking, setLinking] = useState(false)
  const run = () => editor.chain().focus()
  const block = BLOCKS.find((one) => one.id === state.block) ?? BLOCKS[0]

  return (
    // It stays in view while a long document scrolls under it, on a strip of the page's own color.
    <div className="bg-background sticky top-0 z-10 pt-2 pb-1">
     <div className="border-line bg-raised rounded-xl border shadow-[0_1px_2px_hsl(var(--shadow)/0.06)]">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 p-1">
        <Tool label="Undo" shortcut={`${mod}Z`} disabled={!state.undo} onClick={() => run().undo().run()}>
          <Undo2 />
        </Tool>
        <Tool label="Redo" shortcut={`${mod}⇧Z`} disabled={!state.redo} onClick={() => run().redo().run()}>
          <Redo2 />
        </Tool>
        <Divider />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Style: ${block.label}`} className={cn(TOOL, 'text-ink w-[136px] grid-flow-col justify-between gap-1.5 px-2 text-[13.5px] font-medium whitespace-nowrap')}>
            <span className="flex items-center gap-2">
              <block.icon />
              {block.label}
            </span>
            <ChevronDown className="text-quiet size-3.5!" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40 rounded-xl">
            {BLOCKS.map((one) => (
              <DropdownMenuItem
                key={one.id}
                onClick={() => (one.id === 'paragraph' ? run().setParagraph().run() : run().setHeading({ level: Number(one.id[1]) as 1 | 2 | 3 }).run())}
              >
                <one.icon />
                {one.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Divider />
        <Tool label="Bold" shortcut={`${mod}B`} active={state.bold} onClick={() => run().toggleBold().run()}>
          <Bold />
        </Tool>
        <Tool label="Italic" shortcut={`${mod}I`} active={state.italic} onClick={() => run().toggleItalic().run()}>
          <Italic />
        </Tool>
        <Tool label="Strikethrough" active={state.strike} onClick={() => run().toggleStrike().run()}>
          <Strikethrough />
        </Tool>
        <Tool label="Code" shortcut={`${mod}E`} active={state.code} onClick={() => run().toggleCode().run()}>
          <Code />
        </Tool>
        <Divider />
        <Tool label="Bullet list" active={state.bullets} onClick={() => run().toggleBulletList().run()}>
          <List />
        </Tool>
        <Tool label="Numbered list" active={state.numbers} onClick={() => run().toggleOrderedList().run()}>
          <ListOrdered />
        </Tool>
        <Tool label="Checklist" active={state.tasks} onClick={() => run().toggleTaskList().run()}>
          <ListChecks />
        </Tool>
        <Divider />
        <Tool label="Quote" active={state.quote} onClick={() => run().toggleBlockquote().run()}>
          <Quote />
        </Tool>
        <Tool label="Code block" active={state.codeBlock} onClick={() => run().toggleCodeBlock().run()}>
          <SquareCode />
        </Tool>
        <Tool label="Divider" onClick={() => run().setHorizontalRule().run()}>
          <Minus />
        </Tool>
        <Divider />
        <Tool label={state.link ? 'Edit link' : 'Link'} shortcut={`${mod}K`} active={state.link || linking} onClick={() => setLinking((open) => !open)}>
          <Link2 />
        </Tool>
        {state.table ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Table" aria-pressed="true" className={TOOL}>
              <Table />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 rounded-xl">
              <DropdownMenuItem onClick={() => run().addRowAfter().run()}>Add a row below</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run().addRowBefore().run()}>Add a row above</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run().addColumnAfter().run()}>Add a column to the right</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run().addColumnBefore().run()}>Add a column to the left</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => run().deleteRow().run()}>Delete this row</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run().deleteColumn().run()}>Delete this column</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => run().deleteTable().run()}>
                Delete the table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Tool label="Table" onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table />
          </Tool>
        )}
      </div>
      {linking && <LinkBox key={state.href} editor={editor} current={state.href} onDone={() => setLinking(false)} />}
     </div>
    </div>
  )
}

/** Where a link points: typed here, under the toolbar. Only a web or mail address is taken. */
function LinkBox({ editor, current, onDone }: { editor: Editor; current: string; onDone: () => void }) {
  const [typed, setTyped] = useState(current)
  const [refused, setRefused] = useState(false)

  function apply(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return remove()
    const href = typedAddress(typed)
    if (!href) return setRefused(true)
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    onDone()
  }
  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onDone()
  }

  return (
    <form onSubmit={apply} className="border-line flex flex-wrap items-center gap-2 border-t p-2">
      <input
        aria-label="Link address"
        autoFocus
        type="text"
        inputMode="url"
        spellCheck={false}
        autoComplete="off"
        placeholder="https://"
        value={typed}
        aria-invalid={refused}
        onChange={(event) => {
          setTyped(event.target.value)
          setRefused(false)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          // Closes the box only, not the document around it.
          event.preventDefault()
          editor.commands.focus()
          onDone()
        }}
        className="bg-well text-ink h-8 min-w-[180px] flex-1 rounded-md px-2.5 text-[13.5px] shadow-[inset_0_0_0_1px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1px_var(--brand)] aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)]"
      />
      <button type="submit" className="bg-brand text-on-brand h-8 flex-none rounded-md px-3 text-[13px] font-medium">
        {current ? 'Update' : 'Add link'}
      </button>
      {current && (
        <button type="button" onClick={remove} aria-label="Remove link" className={TOOL}>
          <Link2Off />
        </button>
      )}
      {refused && (
        <span role="alert" className="text-destructive basis-full text-[12.5px]">
          Enter a web address, like https://example.com, or a mail address (mailto:).
        </span>
      )}
    </form>
  )
}
