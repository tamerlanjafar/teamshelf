import type { CSSProperties, ReactNode } from 'react'
import { colorValue } from '@/lib/colors'
import type { Space } from '@/lib/types'
import { SpaceLogo } from './space-logo'

/**
 * A space as a small label, tinted with its own color: its logo and name, and optionally more
 * after a "›" (a group, on a suggestion). One label to recognize, not more text to read.
 */
export function SpaceBadge({ space, children }: { space: Pick<Space, 'name' | 'logo' | 'color'> | undefined; children?: ReactNode }) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 rounded-sm bg-[color-mix(in_srgb,var(--space)_12%,transparent)] py-1 pr-2.5 pl-1.5 align-middle text-[12px] leading-4 font-medium text-[color-mix(in_srgb,var(--space)_62%,var(--ink))]"
      style={{ '--space': colorValue(space?.color ?? 'graphite') } as CSSProperties}
    >
      {space && <SpaceLogo space={space} className="size-3.5 rounded-[4px]" />}
      <span className="truncate">{space?.name ?? 'A space'}</span>
      {children && (
        <>
          <span aria-hidden="true" className="opacity-60">
            ›
          </span>
          {children}
        </>
      )}
    </span>
  )
}
