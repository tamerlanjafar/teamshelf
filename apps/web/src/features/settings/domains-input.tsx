import { Plus, X } from 'lucide-react'
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { parseDomains } from './domains'

/**
 * Email domains as chips, one each, with room to type the next. While typing, a list under the
 * field offers to add it (like the group picker), or says how to write a domain. Enter, comma or
 * space adds too (several at once when pasted), Backspace in an empty field takes the last one off.
 */
export function DomainsInput({
  id,
  value,
  onChange,
  onError,
  invalid,
}: {
  id?: string
  value: string[]
  onChange: (domains: string[]) => void
  onError: (error: string | undefined) => void
  invalid: boolean
}) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const typed = draft.trim().toLowerCase().replace(/^@/, '')
  const preview = typed ? parseDomains(typed) : null
  const input = useRef<HTMLInputElement>(null)

  function add(text: string) {
    if (!text.trim()) return true
    const parsed = parseDomains(text)
    if ('error' in parsed) {
      onError(parsed.error)
      return false
    }
    const next = [...new Set([...value, ...parsed.domains])]
    if (next.length > 20) {
      onError('Use at most 20 domains.')
      return false
    }
    onChange(next)
    onError(undefined)
    setDraft('')
    return true
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text')
    if (/[\s,;]/.test(text.trim())) {
      event.preventDefault()
      add(text)
    }
  }

  return (
    <div className="relative">
    {/* The whole box focuses the field, like one input. */}
    {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      onClick={() => input.current?.focus()}
      className={cn(
        'bg-well flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--brand)]',
        invalid && 'shadow-[inset_0_0_0_1px_var(--danger)]',
      )}
    >
      {value.map((domain) => (
        <span key={domain} className="bg-chip text-ink inline-flex items-center gap-1 rounded-xs py-0.5 pr-1 pl-2 text-[13px] shadow-[0_1px_2px_hsl(var(--shadow)/0.12),0_0_0_1px_var(--line)]">
          @{domain}
          <button
            type="button"
            aria-label={`Remove ${domain}`}
            onClick={(event) => {
              event.stopPropagation()
              onChange(value.filter((other) => other !== domain))
            }}
            className="text-quiet hover:text-ink hover:bg-ink/8 grid size-4 place-items-center rounded-xs"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        value={draft}
        role="combobox"
        aria-expanded={Boolean(focused && typed)}
        aria-autocomplete="list"
        placeholder={value.length ? 'Add another' : 'example.com'}
        onChange={(event) => {
          setDraft(event.target.value)
          onError(undefined)
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          add(draft)
        }}
        autoComplete="off"
        spellCheck={false}
        className="placeholder:text-quiet/80 h-7 min-w-[120px] flex-1 bg-transparent px-1 text-[14px] outline-none"
      />
    </div>
    {/* What Enter would do, as an option to click, like the group picker. */}
    {focused && typed && (
      <div role="listbox" className="bg-popover ring-foreground/10 absolute inset-x-0 top-full z-20 mt-1.5 rounded-lg p-1 shadow-md ring-1">
        {preview && 'domains' in preview ? (
          <button
            type="button"
            role="option"
            aria-selected="true"
            // Before the field loses focus, which would add it too.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => add(draft)}
            className="bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[14px]"
          >
            <Plus className="text-quiet size-4" />
            Add <span className="font-semibold">“@{typed}”</span>
          </button>
        ) : (
          <p className="text-quiet m-0 px-2.5 py-2 text-[13.5px]">Enter a valid domain, like example.com</p>
        )}
      </div>
    )}
    </div>
  )
}
