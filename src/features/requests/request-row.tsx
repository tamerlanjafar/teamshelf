import type { CSSProperties, ReactNode } from 'react'
import { Favicon } from '@/features/board/favicon'
import { colorValue } from '@/lib/colors'
import { displayName } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import type { Category, Group, Link, Member } from '@/lib/types'

/** The address without "https://" and a trailing slash, which say nothing when you scan a list. */
const shortAddress = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

/**
 * One suggested link: its name, then one quiet line saying where it goes (group, category)
 * and who sent it, then its address. The buttons given as children sit at the right.
 */
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
    <article className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
      <div className="grid size-9 flex-none place-items-center self-start rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] [&_.favicon]:size-[18px]">
        <Favicon url={link.url} iconUrl={link.icon_url} title={link.title} />
      </div>

      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] leading-snug font-medium">{link.title}</span>
          {status}
        </div>

        <div className="text-quiet flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
          <span>
            in <span className="text-ink">{group?.name ?? link.proposed_group}</span>
          </span>
          {!group && <span className="bg-brand/12 text-brand rounded-full px-1.5 py-px text-[11px] font-semibold">new group</span>}
          {category && (
            <>
              <Dot />
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-(--t)" style={{ '--t': colorValue(category.color) } as CSSProperties} />
                {category.name}
              </span>
            </>
          )}
          <Dot />
          <span>
            {author ? `${displayName(author)}, ` : ''}
            {timeAgo(link.created_at)}
          </span>
        </div>

        <a href={link.url} target="_blank" rel="noreferrer" className="text-quiet hover:text-brand max-w-full truncate text-[13px] underline-offset-2 hover:underline">
          {shortAddress(link.url)}
        </a>

        {link.status === 'rejected' && link.review_note && <div className="mt-0.5 text-[13px]">Reason: {link.review_note}</div>}
      </div>

      <div className="flex flex-none items-center gap-1.5">{children}</div>
    </article>
  )
}

const Dot = () => (
  <span aria-hidden="true" className="opacity-50">
    ·
  </span>
)

export function StatusPill({ tone, children }: { tone: 'waiting' | 'rejected'; children: ReactNode }) {
  const color = tone === 'waiting' ? '#fa8c29' : 'var(--danger)'
  return (
    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ color: `color-mix(in srgb, ${color} 70%, var(--ink))`, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {children}
    </span>
  )
}
