import { createFileRoute } from '@tanstack/react-router'
import { BoardPage } from '@/features/board/board-page'

export const Route = createFileRoute('/$org/')({
  // The search is in the address, so a searched board can be shared.
  validateSearch: (search): { q?: string } => ({ q: typeof search.q === 'string' && search.q ? search.q : undefined }),
  component: Board,
})

function Board() {
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <BoardPage query={q ?? ''} onQueryChange={(query) => navigate({ search: { q: query || undefined }, replace: true })} />
}
