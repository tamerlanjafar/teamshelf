import { EyeOff, FolderPlus, LayoutDashboard, PencilRuler, Plus, RotateCcw, Upload } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { groupsOf, useGroups, useGroupsIfLoaded } from '@/api/groups'
import { useBoardLinks, useBoardLinksIfLoaded, useSetTeamLinkOrder } from '@/api/links'
import { useBoardPrefs, useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { useSetSpaceCardSizes, useSetSpaceLayout } from '@/api/spaces'
import { useConfirm } from '@/components/app/confirm-dialog'
import { BrandMark } from '@/components/app/brand'
import { Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { useCorrectSpaceAddress, useCurrentSpace, useCurrentSpaceIfLoaded } from '@/features/spaces/current-space'
import { NewGroupDialog } from '@/features/spaces/new-group-dialog'
import { NewSpaceDialog } from '@/features/spaces/new-space-dialog'
import { SpaceLogo } from '@/features/spaces/space-logo'
import { COLORS } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import type { Link, Space } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BoardActionsProvider } from './board-actions'
import { CARD, CARD_BODY, CARD_HEAD } from './group-card'
import { ROW, ROW_OPEN } from './link-row'
import { buildBoard, countHidden, type BoardView } from './board-model'
import { LayoutEditorProvider, useLayoutEditor } from './layout-editor'
import { Masonry } from './masonry'
import { arrangementOf, asDefault, hasOwnArrangement, withoutOwnArrangement } from './own-layout'
import { SortableBoard } from './sortable-board'
import { useEffectiveBoardPrefs } from './use-board-prefs'

interface BoardState {
  view: BoardView
  onViewChange: (view: BoardView) => void
}

/**
 * The home page of an organization: the open space's groups as cards, in a grid of columns,
 * with a search above it. The space, the search and the view (the board, or what you hid) are
 * in the address, so a reload stays where you were.
 */
export function BoardPage(props: { view: BoardView; onViewChange: (view: BoardView) => void }) {
  const space = useCurrentSpaceIfLoaded()
  return (
    // A draft of the default layout belongs to one space: opening another starts without one.
    <LayoutEditorProvider key={space?.id ?? 'none'} space={space}>
      <Board {...props} />
    </LayoutEditorProvider>
  )
}

function Board({ view: chosenView, onViewChange }: { view: BoardView; onViewChange: (view: BoardView) => void }) {
  const space = useCurrentSpaceIfLoaded()
  const editing = Boolean(useLayoutEditor().draft)
  // The default layout is edited on the board itself, with everything on it.
  const view = editing ? 'board' : chosenView

  const state: BoardState = { view, onViewChange }

  return (
    <BoardActionsProvider space={space} canReorder={view === 'board'}>
      <BoardBar {...state} />
      {editing && space && <EditingDock space={space} />}
      {/* Room at the bottom for the editor's dock, so the last cards can be reached. */}
      <main className={cn('px-4 pb-10 sm:px-5', editing && 'pb-28')}>
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
  const editing = Boolean(useLayoutEditor().draft)

  // While the space layout is edited, the bar steps back: no search, nothing to add. The editor's dock has the controls.
  if (editing)
    return (
      <TopBar quiet>
        <span className="text-quiet text-[13.5px]">Drag cards and links. Resize cards and columns.</span>
      </TopBar>
    )

  return (
    <TopBar tools={space && view === 'board' && <LayoutMenu space={space} groupIds={groups.map((group) => group.id)} />}>
      <HiddenToggle count={hiddenCount} active={view === 'hidden'} onToggle={() => onViewChange(view === 'hidden' ? 'board' : 'hidden')} />
    </TopBar>
  )
}

/**
 * The space's layout, one quiet button beside "Add". The space layout is the one its admins
 * arranged, which everyone starts from. The menu says whether you see it as it is or with
 * changes of your own (a dot on the button marks those), takes your changes back, and for the
 * space's admins opens its editor.
 */
function LayoutMenu({ space, groupIds }: { space: Space; groupIds: string[] }) {
  const prefs = useBoardPrefsIfLoaded()
  const savePrefs = useSaveBoardPrefs()
  const { isSpaceAdmin } = usePermissions()
  const { start } = useLayoutEditor()
  const confirm = useConfirm()
  const setSpaceLayout = useSetSpaceLayout()
  const setSpaceCardSizes = useSetSpaceCardSizes()
  const setLinkOrder = useSetTeamLinkOrder()
  const changed = hasOwnArrangement(prefs, space.id, groupIds)
  const admin = isSpaceAdmin(space.id)
  // An empty space has nothing to arrange.
  if (groupIds.length === 0) return null

  function reset() {
    const before = arrangementOf(prefs)
    savePrefs.mutate(withoutOwnArrangement(prefs, space.id, groupIds), {
      onError: toastError,
      onSuccess: () => toast('Default layout restored', { action: { label: 'Undo', onClick: () => savePrefs.mutate(before, { onError: toastError }) } }),
    })
  }

  /** Makes your own arrangement the space's default, then drops it: you now see the default, which is the same. */
  async function makeDefault() {
    const made = asDefault(prefs, space, groupIds)
    try {
      await setSpaceLayout.mutateAsync({ id: space.id, layout: made.layout })
      await setSpaceCardSizes.mutateAsync({ id: space.id, sizes: made.sizes })
      for (const [groupId, ids] of made.linkOrders) await setLinkOrder.mutateAsync({ groupId, ids })
      await savePrefs.mutateAsync(withoutOwnArrangement(prefs, space.id, groupIds))
      toast.success('Default layout saved')
    } catch (error) {
      toastError(error)
    }
  }

  const askMakeDefault = () =>
    confirm({
      title: 'Make this the default layout?',
      description: `Everyone in ${space.name} who hasn't changed their own layout will see the board as you see it now.`,
      confirmLabel: 'Save as default',
      tone: 'plain',
      onConfirm: () => void makeDefault(),
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={changed ? 'Space layout: changed by you' : 'Space layout'}
        className="text-quiet hover:text-ink hover:bg-ink/6 data-[popup-open]:bg-ink/6 data-[popup-open]:text-ink relative grid size-10 flex-none place-items-center rounded-lg transition-colors"
      >
        <LayoutDashboard className="size-[19px]" />
        {changed && <span aria-hidden="true" className="bg-brand absolute top-[5px] right-[5px] size-[7px] rounded-full" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <div className="px-2 pt-1.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13.5px] font-semibold">Space layout</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-medium', changed ? 'text-brand bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]' : 'text-quiet bg-ink/6')}>{changed ? 'Changed by you' : 'Default'}</span>
          </div>
          <p className="text-quiet m-0 mt-1 text-[12.5px] leading-snug">{changed ? 'Your own version of the layout, visible only to you.' : "The layout set by this space's admins, shown to everyone."}</p>
        </div>
        {(changed || admin) && <DropdownMenuSeparator />}
        {changed && (
          <DropdownMenuItem onClick={reset}>
            <RotateCcw />
            Reset my changes
          </DropdownMenuItem>
        )}
        {changed && admin && (
          <DropdownMenuItem onClick={askMakeDefault}>
            <Upload />
            Save as default layout…
          </DropdownMenuItem>
        )}
        {/* Not on a phone: there the board is one column, and one column is nobody's layout. */}
        {admin && (
          <DropdownMenuItem className="max-md:hidden" onClick={start}>
            <PencilRuler />
            Edit default layout…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The editor's controls, in a dock at the bottom of the board while a space admin edits the
 * space layout: what is being edited, whether it is saved, and the two ways out. The board
 * above it stays as it is, so what you arrange is what everyone gets.
 */
function EditingDock({ space }: { space: Space }) {
  const { dirty, saving, discard, save } = useLayoutEditor()
  const confirm = useConfirm()

  const leave = () =>
    dirty
      ? confirm({
          title: 'Discard your changes?',
          description: `The layout of ${space.name} stays as it was.`,
          confirmLabel: 'Discard changes',
          onConfirm: discard,
        })
      : discard()

  return (
    // Centered under the board, clear of the sidebar.
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 md:left-[252px]">
      <section
        aria-label="Space layout editor"
        className="bg-ink text-page pointer-events-auto flex max-w-full items-center gap-4 rounded-2xl py-2 pr-2 pl-4 shadow-[0_2px_6px_hsl(var(--shadow)/0.2),0_18px_44px_-12px_hsl(var(--shadow)/0.5)] motion-safe:animate-card-in"
      >
        <LayoutDashboard className="size-[18px] flex-none opacity-80" />
        <div className="min-w-0">
          <h2 className="m-0 truncate text-[14px] leading-tight font-semibold">Editing the layout of {space.name}</h2>
          <p className="m-0 truncate text-[12.5px] opacity-70" aria-live="polite">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'No changes yet'}
          </p>
        </div>
        <div className="ml-14 flex flex-none items-center gap-1.5">
          <button type="button" onClick={leave} disabled={saving} className="hover:bg-page/12 h-9 rounded-lg px-3 text-[13.5px] font-medium transition-colors disabled:opacity-50">
            {/* While saving, the draft empties step by step: the label stays as it was. */}
            {dirty || saving ? 'Discard' : 'Close'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="bg-brand text-on-brand h-9 rounded-lg px-3.5 text-[13.5px] font-semibold transition-opacity disabled:opacity-45 dark:bg-[#4b50e6] dark:text-white"
          >
            {saving ? 'Saving…' : 'Save for everyone'}
          </button>
        </div>
      </section>
    </div>
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
              'bg-surface border-line flex h-10 flex-none items-center gap-2 rounded-lg border px-3.5 tabular-nums transition-colors',
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
function BoardCards({ view, onViewChange }: BoardState) {
  const space = useCurrentSpace()
  useCorrectSpaceAddress(space)
  const { isSpaceAdmin } = usePermissions()
  const groups = groupsOf(useGroups(), space?.id)
  const links = linksOf(useBoardLinks(), space)
  useBoardPrefs()
  const prefs = useEffectiveBoardPrefs()

  if (!space) return <NoSpace />

  const admin = isSpaceAdmin(space.id)
  const cards = buildBoard(groups, links, prefs, { view, keepEmpty: admin })
  const grid = cards.length > 0 && <SortableBoard cards={cards} restoring={view === 'hidden'} footer={admin && view === 'board' ? <NewGroupCard space={space} /> : undefined} />

  if (view === 'hidden') {
    return (
      <>
        <div className="border-line mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed px-4 py-3">
          <EyeOff className="text-quiet size-5 flex-none" />
          <div className="min-w-[200px] flex-1">
            <div className="font-medium">Hidden by you</div>
            <div className="text-quiet text-[13px]">Only you don't see these on your board. Bring back what you need.</div>
          </div>
          <Button variant="outline" size="lg" onClick={() => onViewChange('board')}>
            Back to the board
          </Button>
        </div>
        {grid || <p className="text-quiet m-0 px-1 py-6 text-center">Nothing is hidden any more.</p>}
      </>
    )
  }

  if (grid) return grid
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
      icon={<SpaceLogo space={space} className="size-11 rounded-lg" />}
      title={`Nothing in ${space.name} yet`}
      text={
        admin
          ? 'Start with a group for the tools or topics you use most, then add links, files and documents to it.'
          : `Suggest the first link, file or document. It appears here once an admin of ${space.name} approves it.`
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

/**
 * For someone who sees no space at all: there are none yet, or the ones there are are private.
 * Anyone in the organization can start one.
 */
function NoSpace() {
  const [creating, setCreating] = useState(false)
  return (
    <Notice
      icon={<BrandMark className="size-10" />}
      title="Create a space"
      text="A space is a board for one team or area of your organization. Or ask a space's admin to add you to theirs."
    >
      <Button size="lg" onClick={() => setCreating(true)}>
        <Plus />
        New space
      </Button>
      <NewSpaceDialog open={creating} onOpenChange={setCreating} />
    </Notice>
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
        className="border-line text-quiet hover:text-ink hover:border-brand/50 flex min-h-[88px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-[14.5px] font-medium transition-colors"
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
    <div className="mx-auto flex min-h-[calc(100dvh-140px-2.5rem)] max-w-xl flex-col items-center justify-center gap-2 pb-[72px] text-center lg:min-h-[calc(100dvh-72px-2.5rem)]">
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

/** A bar in the card's color that stands in for text or an icon while it loads. */
function SkeletonBar({ style }: { style: CSSProperties }) {
  return <span className="block flex-none rounded-full bg-[color-mix(in_srgb,var(--c)_28%,transparent)] motion-safe:animate-skeleton" style={style} />
}

/** Empty cards in the shape of the board, while the links load. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading links">
      <Masonry
        items={SKELETON}
        getKey={(item) => item.color}
        estimateHeight={(item) => 62 + item.rows * 34}
        renderItem={(item) => (
          <div className={cn(CARD, 'pointer-events-none animate-none')} style={{ '--c': item.color } as CSSProperties}>
            <div className={CARD_HEAD}>
              <SkeletonBar style={{ width: '45%', height: 14 }} />
            </div>
            <div className={CARD_BODY}>
              {Array.from({ length: item.rows }, (_, index) => (
                <div key={index} className={ROW}>
                  <span className={ROW_OPEN}>
                    <SkeletonBar style={{ width: 16, height: 16, borderRadius: 4 }} />
                    <SkeletonBar style={{ width: `${40 + ((index * 23) % 40)}%`, height: 10 }} />
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
