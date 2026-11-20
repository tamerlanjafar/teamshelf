import type { ReactNode } from 'react'
import { CategoryTag } from '@/features/board/category-tag'
import { Favicon } from '@/features/board/favicon'
import { displayName } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import type { Category, Group, Link, Member } from '@/lib/types'

/** One suggested link: what it is, where it points, who sent it, and the buttons given as children. */
export function RequestRow({
  link,
  group,
  category,
  author,
  status,
  children,
}: {
  link: Link
  group: Group | undefined
  category: Category | undefined
  author?: Member
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
      <div className="flex min-w-[240px] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Favicon url={link.url} title={link.title} />
          <span className="font-medium">
            <span className="text-quiet font-normal">{group?.name ?? link.proposed_group} › </span>
            {link.title}
          </span>
          {category && <CategoryTag category={category} />}
          {!group && <span className="bg-brand/12 text-brand rounded-full px-2 py-0.5 text-[11.5px] font-semibold">New group</span>}
          {status}
        </div>
        <a href={link.url} target="_blank" rel="noreferrer" className="text-quiet hover:text-brand truncate font-mono text-[12.5px] hover:underline">
          {link.url}
        </a>
        <div className="text-quiet text-[12.5px]">
          {author ? `Suggested by ${displayName(author)}, ` : 'Suggested '}
          {timeAgo(link.created_at)}
        </div>
        {link.status === 'rejected' && link.review_note && <div className="text-[12.5px]">Reason: {link.review_note}</div>}
      </div>
      <div className="flex flex-none items-center gap-2">{children}</div>
    </article>
  )
}

export function StatusPill({ tone, children }: { tone: 'waiting' | 'rejected'; children: ReactNode }) {
  const color = tone === 'waiting' ? '#fa8c29' : 'var(--danger)'
  return (
    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ color: `color-mix(in srgb, ${color} 70%, var(--ink))`, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {children}
    </span>
  )
}
