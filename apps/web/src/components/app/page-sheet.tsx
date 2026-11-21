import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * The layout of the pages beside the board: a narrow column with a big title, close to the top
 * of the page (there is no top bar on wide screens). A page under another one (a space's settings)
 * has a link back to it above the title; otherwise the sidebar is the way back.
 */
export function PageSheet({
  title,
  lead,
  action,
  back,
  children,
}: {
  title: string
  lead?: ReactNode
  /** The page's main action, at the right of its title. */
  action?: ReactNode
  /** The page this one belongs to: a link back above the title. */
  back?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-[760px] min-w-0 px-4 pt-1 pb-14 sm:px-5 md:pt-7">
      {back && <div className="mb-3 max-md:hidden">{back}</div>}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-[26px] leading-[1.15] font-[650] tracking-[-0.02em] text-balance break-words [font-family:var(--font-rounded)] sm:text-[30px]">{title}</h1>
        {action}
      </div>
      {lead && <p className="text-quiet mt-2 leading-relaxed">{lead}</p>}
      <div className="mt-7 flex flex-col gap-8">{children}</div>
    </main>
  )
}

/** The look of a link back to the page above (PageSheet's `back`), with its arrow. */
export const BACK_LINK = 'text-quiet hover:text-ink inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors [&_svg]:size-4'
export const BackArrow = ArrowLeft

/** A titled list on a sheet. Its rows share one rounded box, or (cards) each is a card. */
export function SheetGroup({
  title,
  count,
  action,
  cards = false,
  children,
}: {
  title: string
  count?: number
  /** Something to do with the whole list, at the right of its title. */
  action?: ReactNode
  /** Each item is a card of its own, apart from the others, instead of rows in one box. */
  cards?: boolean
  children: ReactNode
}) {
  return (
    <section>
      <div className="mx-1 mb-2.5 flex min-h-8 flex-wrap items-center gap-2">
        <h2 className="text-quiet m-0 flex flex-1 items-center gap-2 text-[13px] font-semibold">
          {title}
          {count !== undefined && <span className="bg-ink/8 rounded-full px-2 py-0.5 text-[11.5px] tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      <div className={cards ? 'flex flex-col gap-2.5' : 'bg-raised border-line divide-line divide-y overflow-hidden rounded-xl border'}>{children}</div>
    </section>
  )
}
