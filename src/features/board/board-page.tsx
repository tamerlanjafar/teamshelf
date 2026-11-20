import { EyeOff, SearchX } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useCategories, useCategoriesIfLoaded } from '@/api/categories'
import { useGroups, useGroupsIfLoaded } from '@/api/groups'
import { useBoardLinks, useBoardLinksIfLoaded } from '@/api/links'
import { useBoardPrefs } from '@/api/prefs'
import { BrandMark } from '@/components/app/brand'
import { Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLinkDialog } from '@/features/links/link-dialog'
import { useMe, useOrg } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { COLORS } from '@/lib/colors'
import { FEATURES } from '@/lib/features'
import { isSuperAdmin } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { BoardActionsProvider } from './board-actions'
import './board.css'
import { buildBoard, countHidden, estimateCardHeight, isFiltering, type BoardFilter, type BoardView } from './board-model'
import { CategorySelect } from './category-select'
import { GroupCard } from './group-card'
import { Masonry } from './masonry'
import { SearchBox } from './search-box'
import { useEffectiveBoardPrefs } from './use-board-prefs'
import { useCategoryFilter } from './use-category-filter'

interface BoardState {
  filter: BoardFilter
  onFilterChange: (filter: BoardFilter) => void
  view: BoardView
  onViewChange: (view: BoardView) => void
}

/**
 * The home page of an organization: every group as a card, in a grid of columns, with a search
 * above it. The search is in the address (so it can be shared), the category is remembered.
 */
export function BoardPage({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  const me = useMe()
  const org = useOrg()
  const [categoryId, setCategoryId] = useCategoryFilter(org.id, useCategoriesIfLoaded())
  const [view, setView] = useState<BoardView>('board')

  const filter: BoardFilter = { query, categoryId }
  const state: BoardState = {
    filter,
    onFilterChange: (next) => {
      if (next.query !== query) onQueryChange(next.query)
      if (next.categoryId !== categoryId) setCategoryId(next.categoryId)
    },
    view,
    onViewChange: setView,
  }
  const canReorder = view === 'board' && !isFiltering(filter) && (isSuperAdmin(me) || FEATURES.personalOrder)

  return (
    <BoardActionsProvider canReorder={canReorder}>
      <BoardBar {...state} />
      <main className="px-5 pb-10">
        <Section skeleton={<BoardSkeleton />}>
          <BoardCards {...state} />
        </Section>
      </main>
    </BoardActionsProvider>
  )
}

/** The top bar with the board's controls. It is always there, and fills in as the data arrives. */
function BoardBar({ filter, onFilterChange, view, onViewChange }: BoardState) {
  const groups = useGroupsIfLoaded()
  const links = useBoardLinksIfLoaded()
  const categories = useCategoriesIfLoaded()
  const prefs = useEffectiveBoardPrefs()

  const cards = buildBoard(groups, links, prefs, { filter, view, keepEmpty: false })
  const found = cards.reduce((sum, card) => sum + card.links.length, 0)
  const usedCategories = categories.filter((category) => category.id === filter.categoryId || links.some((link) => link.category_id === category.id))
  const hiddenCount = countHidden(groups, links, prefs)

  /** Enter in the search opens the link when only one is left. */
  function openOnlyMatch() {
    if (found === 1) window.open(cards.find((card) => card.links.length)!.links[0].link.url, '_blank', 'noreferrer')
  }

  return (
    <TopBar>
      <SearchBox value={filter.query} resultCount={filter.query.trim() ? found : null} onChange={(query) => onFilterChange({ ...filter, query })} onEnter={openOnlyMatch} />
      <CategorySelect categories={usedCategories} value={filter.categoryId} onChange={(categoryId) => onFilterChange({ ...filter, categoryId })} />
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
              'bg-surface border-line flex h-11 flex-none items-center gap-2 rounded-xl border px-3.5 tabular-nums transition-colors',
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

/** The cards. Suspends until the groups, the links and this person's preferences are all loaded. */
function BoardCards({ filter, onFilterChange, view, onViewChange }: BoardState) {
  const me = useMe()
  const groups = useGroups()
  const links = useBoardLinks()
  const categories = useCategories()
  useBoardPrefs()
  const prefs = useEffectiveBoardPrefs()

  const cards = buildBoard(groups, links, prefs, { filter, view, keepEmpty: isSuperAdmin(me) })
  const grid = cards.length > 0 && (
    <Masonry items={cards} getKey={(card) => card.group.id} estimateHeight={estimateCardHeight} renderItem={(card) => <GroupCard card={card} categories={categories} restoring={view === 'hidden'} />} />
  )

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
        {grid || <p className="text-quiet m-0 px-1 py-6 text-center">{isFiltering(filter) ? 'Nothing you hid matches the search or category.' : 'Nothing is hidden any more.'}</p>}
      </>
    )
  }

  if (grid) return grid
  if (isFiltering(filter)) {
    return (
      <Notice icon={<SearchX className="text-quiet size-9" strokeWidth={1.5} />} title="No link matches" text="Try fewer words, or another category.">
        <Button variant="outline" size="lg" onClick={() => onFilterChange({ query: '', categoryId: null })}>
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
  return <EmptyBoard />
}

function EmptyBoard() {
  const { reviewer } = usePermissions()
  const { addLink } = useLinkDialog()
  return (
    <Notice
      icon={<BrandMark className="size-10" />}
      title="No links yet"
      text={reviewer ? 'Add the first one. Links that share a group sit on one card.' : 'Suggest the first one. It appears here once it has been reviewed.'}
    >
      <Button size="lg" onClick={() => addLink()}>
        {reviewer ? 'Add a link' : 'Suggest a link'}
      </Button>
    </Notice>
  )
}

function Notice({ icon, title, text, children }: { icon?: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 pt-[14vh] text-center">
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
