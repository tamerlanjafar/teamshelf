import type { ReactNode } from 'react'
import { formatBytes } from '@/api/files'
import { Favicon } from '@/features/board/favicon'
import { FileIcon } from '@/features/board/file-icon'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { displayName } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import type { Group, Link, Member, Space } from '@/lib/types'

/** The address without "https://" and a trailing slash, which say nothing when you scan a list. */
const shortAddress = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

/**
 * One suggested link: its name, then one quiet line saying where it goes (space, group)
 * and who sent it, then its address or file. The buttons given as children sit at the right.
 */
export function RequestRow({
  link,
  group,
  space,
  author,
  status,
  children,
}: {
  link: Link
  group: Group | undefined
  space: Space | undefined
  author?: Member
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:gap-x-5 sm:px-5">
      <div className="grid size-9 flex-none place-items-center self-start rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] [&_.favicon]:size-[18px]">
        {link.kind === 'file' ? <FileIcon type={link.file_type} name={link.file_name} /> : <Favicon url={link.url} iconUrl={link.icon_url} title={link.title} />}
      </div>

      <div className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] leading-snug font-medium">{link.title}</span>
          {status}
        </div>

        <div className="text-quiet flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
          {space && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <SpaceLogo space={space} className="size-4 rounded-[5px]" />
              <span className="text-ink truncate">{space.name}</span>
            </span>
          )}
          <span aria-hidden="true">›</span>
          <span className="text-ink">{group?.name ?? link.proposed_group}</span>
          {!group && <span className="bg-brand/12 text-brand rounded-full px-1.5 py-px text-[11px] font-semibold">new group</span>}
          <Dot />
          <span>
            {author ? `${displayName(author)}, ` : ''}
            {timeAgo(link.created_at)}
          </span>
        </div>

        {link.kind === 'file' ? (
          <span className="text-quiet max-w-full truncate text-[13px]">
            {link.file_name} · {formatBytes(link.file_size ?? 0)}
          </span>
        ) : (
          <a href={link.url} target="_blank" rel="noreferrer" className="text-quiet hover:text-brand max-w-full truncate text-[13px] underline-offset-2 hover:underline">
            {shortAddress(link.url)}
          </a>
        )}

        {link.status === 'rejected' && link.review_note && <div className="mt-0.5 text-[13px]">Reason: {link.review_note}</div>}
      </div>

      <div className="flex flex-none flex-wrap items-center gap-1.5 max-sm:w-full max-sm:justify-end">{children}</div>
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
