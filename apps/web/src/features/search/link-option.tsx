import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Favicon } from '@/features/board/favicon'
import { FileIcon } from '@/features/board/file-icon'
import type { Link } from '@/lib/types'
import { Kbd } from '@/components/app/kbd'
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
  /** The group's color. */
  color: string
}

/**
 * One compact line: icon, and "Group / Name" (with the space in front when it is another one).
 * With `onRemove` (a recent link), an × on the right takes it off the list: shown on the line
 * pointed at or chosen, and always on a touch screen, where nothing is pointed at.
 */
export function LinkOption({ id, choice, selected, onHover, onChoose, onRemove }: { id: string; choice: LinkChoice; selected: boolean; onHover: () => void; onChoose: () => void; onRemove?: () => void }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onPointerMove={onHover}
      onClick={onChoose}
      className={cn('group/option flex h-8 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]', onRemove && 'pr-1', selected && 'bg-[color-mix(in_srgb,var(--brand)_9%,transparent)]')}
      style={{ '--c': choice.color } as CSSProperties}
    >
      {choice.link.kind === 'file' ? <FileIcon type={choice.link.file_type} name={choice.link.file_name} /> : <Favicon url={choice.link.url} iconUrl={choice.link.icon_url} title={choice.title} />}
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
      </span>
      {onRemove && (
        <button
          type="button"
          // The field keeps the focus: Delete does the same from the keyboard.
          tabIndex={-1}
          aria-label={`Remove ${choice.title} from recent`}
          title="Remove from recent"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className={cn(
            'text-quiet hover:text-ink hover:bg-ink/8 grid size-6 shrink-0 place-items-center rounded-md transition-colors',
            !selected && 'opacity-0 group-hover/option:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  )
}

/** A small uppercase label over a list, with something to do on its right if needed. */
export const MenuLabel = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="text-quiet px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-[0.05em] uppercase">{children}</div>
    {action}
  </div>
)

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** The keys, under a list. `remove`: Delete takes the chosen line off it. */
export function MenuKeys({ className, remove }: { className?: string; remove?: boolean }) {
  return (
    <div className={cn('text-quiet border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3.5 py-2 text-[12px] max-sm:hidden', className)}>
      <span className="flex items-center gap-1.5">
        <Kbd keyName="up" size="small" />
        <Kbd keyName="down" size="small" />
        choose
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd keyName="enter" size="small" />
        open
      </span>
      {remove && (
        <span className="flex items-center gap-1.5">
          <Kbd keyName={MAC ? '⌘⌫' : 'del'} size="small" />
          remove
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <Kbd keyName="esc" size="small" />
        close
      </span>
    </div>
  )
}
