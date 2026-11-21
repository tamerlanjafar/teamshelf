import { Meter } from '@base-ui/react/meter'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { bytes, share } from '@/lib/format'

/** A page's title and what it is about. */
export function PageHead({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[26px] leading-tight font-[650] tracking-[-0.02em] [font-family:var(--font-rounded)]">{title}</h1>
        <p className="text-quiet m-0 mt-1">{lead}</p>
      </div>
      {children}
    </header>
  )
}

/** One number that matters, with what it counts and, under it, what changed lately. */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface rounded-2xl border p-4">
      <div className="text-quiet text-[13px]">{label}</div>
      <div className="mt-1 text-[28px] leading-none font-[650] tracking-[-0.02em] tabular-nums [font-family:var(--font-rounded)]">{value}</div>
      {note && <div className="text-quiet mt-2 text-[12.5px] tabular-nums">{note}</div>}
    </div>
  )
}

/**
 * How much of its room something has used. Nearly full and full are said in words beside the
 * bar, not by its color alone.
 */
export function Storage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = share(used, limit)
  const state = percent >= 100 ? 'Full' : percent >= 80 ? 'Nearly full' : null
  return (
    <Meter.Root value={percent} aria-label={label} aria-valuetext={`${bytes(used)} of ${bytes(limit)}`} className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="text-quiet flex-none text-[13px] tabular-nums">
          {state && <span className={cn('mr-2 font-medium', percent >= 100 ? 'text-danger' : 'text-warning')}>{state}</span>}
          {bytes(used)} of {bytes(limit)}
        </span>
      </div>
      <Meter.Track className="bg-well h-2 overflow-hidden rounded-full">
        <Meter.Indicator className={cn('h-full rounded-full', percent >= 100 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-brand')} />
      </Meter.Track>
    </Meter.Root>
  )
}

/** A message in the middle of an empty page. */
export function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-content-center gap-2 text-center">
      <h1 className="m-0 text-[22px] font-[650] [font-family:var(--font-rounded)]">{title}</h1>
      <p className="text-quiet m-0 leading-relaxed">{text}</p>
      {children && <div className="mt-3 flex justify-center">{children}</div>}
    </div>
  )
}

export const BUTTON = 'bg-brand text-on-brand inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 font-medium disabled:opacity-60'
export const QUIET_BUTTON = 'bg-surface text-ink hover:bg-well inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-[13.5px] font-medium'
