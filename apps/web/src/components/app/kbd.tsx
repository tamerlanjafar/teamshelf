import type { SVGProps } from 'react'
import { ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "/" as typed: steeper than a diagonal, unlike the slash icons in icon sets. */
function Slash({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M15 3.5 9 20.5" />
    </svg>
  )
}

/** Keys drawn as icons: an icon sits in the middle of the key, where a font's glyph doesn't. */
const ICONS = { up: ArrowUp, down: ArrowDown, enter: CornerDownLeft, slash: Slash }
const NAMES = { up: 'Up arrow', down: 'Down arrow', enter: 'Enter', slash: 'Slash' }

/**
 * A key on the keyboard, as a small key cap. Arrows, Enter and "/" are icons; a word ("esc",
 * "del", "⌘⌫") is trimmed to the height of its small letters, so it sits in the middle of the cap too.
 */
export function Kbd({ keyName, size = 'default', className }: { keyName: keyof typeof ICONS | 'esc' | 'del' | '⌘⌫'; size?: 'default' | 'small'; className?: string }) {
  const small = size === 'small'
  const Icon = keyName in ICONS ? ICONS[keyName as keyof typeof ICONS] : null
  return (
    <kbd
      aria-label={Icon ? NAMES[keyName as keyof typeof NAMES] : keyName === '⌘⌫' ? 'Command Backspace' : undefined}
      className={cn('inline-flex! items-center justify-center', small ? 'h-[18px]! min-w-[18px]! px-1! text-[10.5px]!' : '', className)}
    >
      {Icon ? <Icon className={small ? 'size-[11px]' : 'size-3'} strokeWidth={2.25} /> : <span className="[text-box:trim-both_ex_alphabetic]">{keyName}</span>}
    </kbd>
  )
}
