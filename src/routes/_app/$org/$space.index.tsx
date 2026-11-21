import { createFileRoute } from '@tanstack/react-router'
import { BoardPage } from '@/features/board/board-page'

interface BoardSearch {
  /** "hidden": the view of what you hid. Left out for the board itself. */
  view?: 'hidden'
}

/** A space's board: /<org>/<space>. */
export const Route = createFileRoute('/_app/$org/$space/')({
  // In the address, so a reload (or a shared address) shows the same thing.
  validateSearch: (search): BoardSearch => ({
    view: search.view === 'hidden' ? 'hidden' : undefined,
  }),
  component: Board,
})

function Board() {
  const { view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <BoardPage
      view={view ?? 'board'}
      onViewChange={(next) => navigate({ search: (current) => ({ ...current, view: next === 'hidden' ? 'hidden' : undefined }) })}
    />
  )
}
