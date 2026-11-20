import type { CSSProperties, ReactNode } from 'react'
import { Favicon } from '@/features/board/favicon'
import { FileIcon } from '@/features/board/file-icon'
import { isProduction } from '@/lib/environments'
import type { Link } from '@/lib/types'
import { cn } from '@/lib/utils'

// The parts the two link menus share (the board search's "Recent" list and the command menu),
// so both look and behave the same.

/** A link as a menu shows it: its name as its card shows it, and where it is. */
export interface LinkChoice {
  link: Link
  title: string
  groupName: string
  /** Only for a link of another space than the open one. */
  spaceName?: string
  environment: string | null
  /** The group's color. */
  color: string
}

/** One compact line: icon, "Group / Name" (with the space in front when it is another one), environment. */
export function LinkOption({ id, choice, selected, onHover, onChoose }: { id: string; choice: LinkChoice; selected: boolean; onHover: () => void; onChoose: () => void }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onPointerMove={onHover}
      onClick={onChoose}
      className={cn('flex h-8 min-w-0 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px]', selected && 'bg-[color-mix(in_srgb,var(--brand)_9%,transparent)]')}
      style={{ '--c': choice.color } as CSSProperties}
    >
      {choice.link.kind === 'file' ? <FileIcon type={choice.link.file_type} name={choice.link.file_name} /> : <Favicon url={choice.link.url} iconUrl={choice.link.icon_url} title={choice.title} />}
      {/* The environment follows the name directly, so it reads as part of it. */}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate">
          {choice.spaceName && (
            <>
              <span className="text-quiet">{choice.spaceName}</span>
              <span className="text-quiet/60 mx-1.5">/</span>
            </>
          )}
          <span className="text-quiet">{choice.groupName}</span>
          <span className="text-quiet/60 mx-1.5">/</span>
          <span className="text-ink font-medium">{choice.title}</span>
        </span>
        {choice.environment && (
          <span
            className={cn(
              'flex-none rounded-full px-1.5 py-px text-[10.5px] font-semibold [font-family:var(--font-rounded)]',
              isProduction(choice.environment) ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand',
            )}
          >
            {choice.environment}
          </span>
        )}
      </span>
    </li>
  )
}

/** A small uppercase label over a list. */
export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="text-quiet px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-[0.05em] uppercase">{children}</div>

/** The keys, under a list. */
export function MenuKeys({ className }: { className?: string }) {
  return (
    <div className={cn('text-quiet border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3.5 py-2 text-[12px] max-sm:hidden [&_kbd]:h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:px-1 [&_kbd]:text-[10.5px]', className)}>
      <span className="flex items-center gap-1.5">
        <kbd>↑</kbd>
        <kbd>↓</kbd>
        choose
      </span>
      <span className="flex items-center gap-1.5">
        <kbd>↵</kbd>
        open
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <kbd>esc</kbd>
        close
      </span>
    </div>
  )
}
