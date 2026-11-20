import { createFileRoute } from '@tanstack/react-router'
import { BoardPage } from '@/features/board/board-page'

interface BoardSearch {
  q?: string
  /** "hidden": the view of what you hid. Left out for the board itself. */
  view?: 'hidden'
}

export const Route = createFileRoute('/$org/')({
  // In the address, so a reload (or a shared address) shows the same thing.
  validateSearch: (search): BoardSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    view: search.view === 'hidden' ? 'hidden' : undefined,
  }),
  component: Board,
})

function Board() {
  const { q, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <BoardPage
      query={q ?? ''}
      onQueryChange={(query) => navigate({ search: (current) => ({ ...current, q: query || undefined }), replace: true })}
      view={view ?? 'board'}
      onViewChange={(next) => navigate({ search: (current) => ({ ...current, view: next === 'hidden' ? 'hidden' : undefined }) })}
    />
  )
}
