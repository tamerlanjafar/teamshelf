import { EyeOff, FolderPlus, SearchX } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { groupsOf, useGroups, useGroupsIfLoaded } from '@/api/groups'
import { useBoardLinks, useBoardLinksIfLoaded } from '@/api/links'
import { useBoardPrefs } from '@/api/prefs'
import { BrandMark } from '@/components/app/brand'
import { Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { useCorrectSpaceAddress, useCurrentSpace, useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { NewGroupDialog } from '@/features/spaces/new-group-dialog'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { COLORS } from '@/lib/colors'
import { FEATURES } from '@/lib/features'
import type { Link, Space } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BoardActionsProvider } from './board-actions'
import './board.css'
import { buildBoard, countHidden, isFiltering, type BoardFilter, type BoardView } from './board-model'
import { Masonry } from './masonry'
import { QuickFind } from '@/features/search/quick-find'
import { SortableBoard } from './sortable-board'
import { useEffectiveBoardPrefs } from './use-board-prefs'

interface BoardState {
  filter: BoardFilter
  onFilterChange: (filter: BoardFilter) => void
  view: BoardView
  onViewChange: (view: BoardView) => void
}

/**
 * The home page of an organization: the open space's groups as cards, in a grid of columns,
 * with a search above it. The space, the search and the view (the board, or what you hid) are
 * in the address, so a reload stays where you were.
 */
export function BoardPage({ view, onViewChange }: { view: BoardView; onViewChange: (view: BoardView) => void }) {
  const space = useCurrentSpaceIfLoaded()
  const { isSpaceAdmin } = usePermissions()

  // The board shows everything: the search at the top finds and opens a link instead of filtering.
  const filter: BoardFilter = { query: '' }
  const state: BoardState = {
    filter,
    onFilterChange: () => {},
    view,
    onViewChange,
  }
  const canReorder = view === 'board' && !isFiltering(filter) && (isSpaceAdmin(space?.id) || FEATURES.personalOrder)

  return (
    <BoardActionsProvider space={space} canReorder={canReorder}>
      <BoardBar {...state} />
      <main className="px-4 pb-10 sm:px-5">
        <Section skeleton={<BoardSkeleton />}>
          <BoardCards {...state} />
        </Section>
      </main>
    </BoardActionsProvider>
  )
}

/** The links of one space. */
const linksOf = (links: Link[], space: Space | null) => links.filter((link) => link.space_id === space?.id)

/** The top bar with the board's controls. It is always there, and fills in as the data arrives. */
function BoardBar({ view, onViewChange }: BoardState) {
  const space = useCurrentSpaceIfLoaded()
  const groups = groupsOf(useGroupsIfLoaded(), space?.id)
  const links = linksOf(useBoardLinksIfLoaded(), space)
  const prefs = useEffectiveBoardPrefs()
  const hiddenCount = countHidden(groups, links, prefs)

  return (
    <TopBar>
      <QuickFind />
      <HiddenToggle count={hiddenCount} active={view === 'hidden'} onToggle={() => onViewChange(view === 'hidden' ? 'board' : 'hidden')} />
    </TopBar>
  )
}

/** Switches to the view of what you hid. Only there when you hid something. */
function HiddenToggle({ count, active, onToggle }: { count: number; active: boolean; onToggle: () => void }) {
  if (count === 0 && !active) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-pressed={active}
            aria-label={`Hidden by you: ${count}`}
            onClick={onToggle}
            className={cn(
              'bg-surface border-line flex h-10 flex-none items-center gap-2 rounded-xl border px-3.5 tabular-nums transition-colors',
              active ? 'border-brand text-brand bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))]' : 'text-quiet hover:text-ink',
            )}
          />
        }
      >
        <EyeOff className="size-[18px]" />
        <span className="font-medium">{count}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{active ? 'Back to the board' : 'What you hid'}</TooltipContent>
    </Tooltip>
  )
}

/** The cards. Suspends until the spaces, groups, links and this person's preferences are all loaded. */
function BoardCards({ filter, onFilterChange, view, onViewChange }: BoardState) {
  const space = useCurrentSpace()
  useCorrectSpaceAddress(space)
  const { isSpaceAdmin } = usePermissions()
  const groups = groupsOf(useGroups(), space?.id)
  const links = linksOf(useBoardLinks(), space)
  useBoardPrefs()
  const prefs = useEffectiveBoardPrefs()

  if (!space) return <NoSpace />

  const admin = isSpaceAdmin(space.id)
  const cards = buildBoard(groups, links, prefs, { filter, view, keepEmpty: admin })
  const grid = cards.length > 0 && <SortableBoard cards={cards} restoring={view === 'hidden'} footer={admin && view === 'board' && !isFiltering(filter) ? <NewGroupCard space={space} /> : undefined} />

  if (view === 'hidden') {
    return (
      <>
        <div className="border-line mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed px-4 py-3">
          <EyeOff className="text-quiet size-5 flex-none" />
          <div className="min-w-[200px] flex-1">
            <div className="font-medium">Hidden by you</div>
            <div className="text-quiet text-[13px]">Only you don't see these on your board. Bring back what you need.</div>
          </div>
          <Button variant="outline" size="lg" onClick={() => onViewChange('board')}>
            Back to the board
          </Button>
        </div>
        {grid || <p className="text-quiet m-0 px-1 py-6 text-center">{isFiltering(filter) ? 'Nothing you hid matches the search.' : 'Nothing is hidden any more.'}</p>}
      </>
    )
  }

  if (grid) return grid
  if (isFiltering(filter)) {
    return (
      <Notice icon={<SearchX className="text-quiet size-9" strokeWidth={1.5} />} title="No link matches" text={`Nothing in ${space.name} has all of these words. Try fewer, or another space.`}>
        <Button variant="outline" size="lg" onClick={() => onFilterChange({ query: '' })}>
          Show everything
        </Button>
      </Notice>
    )
  }
  if (countHidden(groups, links, prefs) > 0) {
    return (
      <Notice icon={<EyeOff className="text-quiet size-9" strokeWidth={1.5} />} title="Everything is hidden" text="You hid all there is to see here. You can bring it back.">
        <Button variant="outline" size="lg" onClick={() => onViewChange('hidden')}>
          See what I hid
        </Button>
      </Notice>
    )
  }
  return <EmptySpace space={space} admin={admin} />
}

function EmptySpace({ space, admin }: { space: Space; admin: boolean }) {
  const { addLink } = useLinkDialog()
  const [creating, setCreating] = useState(false)
  return (
    <Notice
      icon={<SpaceLogo space={space} className="size-11 rounded-[12px]" />}
      title={`Nothing in ${space.name} yet`}
      text={
        admin
          ? 'Start with a group, like “Figma” or “Dashboards”, then add links and files to it.'
          : `Suggest the first link or file. It appears here once an admin of ${space.name} approves it.`
      }
    >
      {admin ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={() => setCreating(true)}>
            <FolderPlus />
            New group
          </Button>
          <Button size="lg" variant="outline" onClick={() => addLink()}>
            Add a link
          </Button>
          <NewGroupDialog space={space} open={creating} onOpenChange={setCreating} />
        </div>
      ) : (
        <Button size="lg" onClick={() => addLink()}>
          Suggest a link
        </Button>
      )}
    </Notice>
  )
}

/** For someone who sees no space at all: every space is private and they are in none. */
function NoSpace() {
  const { admin } = usePermissions()
  return (
    <Notice
      icon={<BrandMark className="size-10" />}
      title="No spaces for you yet"
      text={admin ? 'Create the first space from the menu at the top, for a team like Development or Design.' : 'Every space here is private. Ask a space’s admin to add you.'}
    />
  )
}

/** The last card on an admin's board: starts a new group in the space. */
function NewGroupCard({ space }: { space: Space }) {
  const [creating, setCreating] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="border-line text-quiet hover:text-ink hover:border-brand/50 flex min-h-[88px] w-full items-center justify-center gap-2 rounded-[18px] border border-dashed text-[14.5px] font-medium transition-colors"
      >
        <FolderPlus className="size-[18px]" />
        New group
      </button>
      <NewGroupDialog space={space} open={creating} onOpenChange={setCreating} />
    </>
  )
}

function Notice({ icon, title, text, children }: { icon?: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px-2.5rem)] max-w-sm flex-col items-center justify-center gap-2 pb-[72px] text-center lg:min-h-[calc(100dvh-72px-2.5rem)]">
      {icon}
      <h2 className="mt-2 text-[20px] font-[650] [font-family:var(--font-rounded)]">{title}</h2>
      <p className="text-quiet m-0 leading-relaxed">{text}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

const SKELETON = [
  { color: COLORS.blue, rows: 4 },
  { color: COLORS.green, rows: 2 },
  { color: COLORS.orange, rows: 5 },
  { color: COLORS.purple, rows: 3 },
  { color: COLORS.teal, rows: 3 },
  { color: COLORS.pink, rows: 2 },
  { color: COLORS.indigo, rows: 4 },
  { color: COLORS.yellow, rows: 2 },
]

/** Empty cards in the shape of the board, while the links load. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading links">
      <Masonry
        items={SKELETON}
        getKey={(item) => item.color}
        estimateHeight={(item) => 62 + item.rows * 34}
        renderItem={(item) => (
          <div className="room skeleton" style={{ '--c': item.color } as CSSProperties}>
            <div className="room-head">
              <span className="skeleton-bar" style={{ width: '45%', height: 14 }} />
            </div>
            <div className="room-body">
              {Array.from({ length: item.rows }, (_, index) => (
                <div key={index} className="tab">
                  <span className="open">
                    <span className="skeleton-bar" style={{ width: 16, height: 16, borderRadius: 4 }} />
                    <span className="skeleton-bar" style={{ width: `${40 + ((index * 23) % 40)}%`, height: 10 }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  )
}
