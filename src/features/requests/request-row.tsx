import type { ReactNode } from 'react'
import { formatBytes } from '@/api/files'
import { Favicon } from '@/features/board/favicon'
import { FileIcon } from '@/features/board/file-icon'
import { SpaceBadge } from '@/features/spaces/space-badge'
import { displayName } from '@/lib/roles'
import { timeAgo } from '@/lib/time'
import { useMe } from '@/features/org/org-context'
import type { Group, Link, Member, Space } from '@/lib/types'

/** The address without "https://" and a trailing slash, which say nothing when you scan a list. */
const shortAddress = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

/**
 * One suggested link, as a card (SheetGroup cards), in three columns centered on one line: its
 * icon; its name with where it would go (space › group), over the address it opens and when (and
 * by whom, if not you); and the buttons given as children, alone at the right. A rejected one
 * says why underneath, on the text's left edge.
 */
export function RequestRow({
  link,
  group,
  space,
  author,
  children,
}: {
  link: Link
  group: Group | undefined
  space: Space | undefined
  author?: Member
  children: ReactNode
}) {
  const me = useMe()
  const byOther = author && author.id !== me.id

  const destination = (
    <SpaceBadge space={space}>
      <span className="truncate">{group?.name ?? link.proposed_group}</span>
      {!group && <span className="opacity-70">(new)</span>}
    </SpaceBadge>
  )

  return (
    <article className="bg-raised border-line rounded-2xl border p-4">
      {/* Three columns, all centered on one line: the icon, the text, and the buttons alone at the right. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <span className="bg-well grid size-10 flex-none place-items-center rounded-md [&_.favicon]:size-[18px]">
          {link.kind === 'file' ? <FileIcon type={link.file_type} name={link.file_name} /> : <Favicon url={link.url} iconUrl={link.icon_url} title={link.title} />}
        </span>

        <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] leading-6 font-medium">{link.title}</span>
            {destination}
          </div>
          <div className="text-quiet flex min-w-0 items-center gap-1.5 text-[13px] leading-5">
            {link.kind === 'file' ? (
              <span className="truncate">
                {link.file_name} · {formatBytes(link.file_size ?? 0)}
              </span>
            ) : (
              <a href={link.url} target="_blank" rel="noreferrer" className="text-brand min-w-0 truncate underline-offset-2 hover:underline">
                {shortAddress(link.url)}
              </a>
            )}
            <span aria-hidden="true">·</span>
            <span className="flex-none tabular-nums">
              {byOther ? `${displayName(author)}, ` : ''}
              {timeAgo(link.created_at)}
            </span>
          </div>
        </div>

        <div className="flex flex-none items-center gap-1.5 max-sm:w-full max-sm:justify-end">{children}</div>
      </div>

      {link.status === 'rejected' && link.review_note && (
        <div className="mt-3 ml-[52px] rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-[13px] leading-snug max-sm:ml-0">
          <span className="text-danger font-semibold">Rejected: </span>
          {link.review_note}
        </div>
      )}
    </article>
  )
}
