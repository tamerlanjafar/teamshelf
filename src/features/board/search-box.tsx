import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** The field that filters the board. "/" jumps to it from anywhere, Escape clears it. */
export function SearchBox({ value, resultCount, onChange, onEnter }: { value: string; resultCount: number | null; onChange: (value: string) => void; onEnter: () => void }) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      const dialogOpen = Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'))
      if (event.key === '/' && !typing && !dialogOpen && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="group relative flex min-w-[260px] flex-1 items-center max-sm:min-w-0">
      <Search className="text-quiet pointer-events-none absolute left-3.5 size-[18px]" />
      <input
        ref={input}
        type="search"
        value={value}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="Search links"
        aria-label="Search links"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onEnter()
          if (event.key === 'Escape' && value) onChange('')
        }}
        className="peer bg-surface border-line placeholder:text-quiet focus:border-brand h-11 w-full rounded-xl border pr-24 pl-[42px] text-[16px] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {resultCount !== null ? (
        <span className="text-quiet pointer-events-none absolute right-3.5 tabular-nums">
          {resultCount} {resultCount === 1 ? 'link' : 'links'}
        </span>
      ) : (
        <kbd className="pointer-events-none absolute right-3 peer-focus:hidden">/</kbd>
      )}
    </div>
  )
}
