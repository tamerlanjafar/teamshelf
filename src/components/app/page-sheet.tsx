import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOrg } from '@/features/org/org-context'

/** The layout of the pages beside the board: a narrow column with a way back and a big title. */
export function PageSheet({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  const org = useOrg()
  return (
    <main className="mx-auto w-full max-w-[760px] px-5 pt-1 pb-14">
      <Link to="/$org" params={{ org: org.slug }} search={{}} className="text-quiet hover:text-ink hover:bg-raised -ml-2 inline-flex items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-1">
        <ChevronLeft className="size-4" />
        Links
      </Link>
      <h1 className="mt-1.5 text-[30px] leading-[1.15] font-[650] tracking-[-0.02em] [font-family:var(--font-rounded)]">{title}</h1>
      {lead && <p className="text-quiet mt-2 max-w-[60ch] leading-relaxed">{lead}</p>}
      <div className="mt-7 flex flex-col gap-8">{children}</div>
    </main>
  )
}

/** A titled list on a sheet. Its rows share one rounded box. */
export function SheetGroup({ title, count, action, children }: { title: string; count?: number; /** Something to do with the whole list, at the right of its title. */ action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mx-1 mb-2.5 flex min-h-8 items-center gap-2">
        <h2 className="text-quiet m-0 flex flex-1 items-center gap-2 text-[13px] font-semibold">
          {title}
          {count !== undefined && <span className="bg-ink/8 rounded-full px-2 py-0.5 text-[11.5px] tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="bg-raised border-line divide-line divide-y overflow-hidden rounded-[14px] border">{children}</div>
    </section>
  )
}
