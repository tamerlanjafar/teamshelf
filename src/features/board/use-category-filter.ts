import { useState } from 'react'
import type { Category } from '@/lib/types'

const key = (orgId: string) => `linkboard-categories:${orgId}`

function read(orgId: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key(orgId)) ?? '[]')
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * The categories the board is narrowed to (none means all). People choose them once
 * ("I'm frontend, and I follow infrastructure") and rarely change them, so they are remembered
 * in this browser, per organization, instead of starting at "all" on every visit.
 */
export function useCategoryFilter(orgId: string, categories: Category[]) {
  const [stored, setStored] = useState(() => read(orgId))
  // A remembered category that has been deleted since is left out.
  const categoryIds = stored.filter((id) => categories.some((category) => category.id === id))

  function setCategoryIds(next: string[]) {
    setStored(next)
    try {
      if (next.length) localStorage.setItem(key(orgId), JSON.stringify(next))
      else localStorage.removeItem(key(orgId))
    } catch {
      // Without storage the choice lasts until the page is closed.
    }
  }

  return [categoryIds, setCategoryIds] as const
}
