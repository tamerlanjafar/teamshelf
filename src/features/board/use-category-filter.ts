import { useState } from 'react'
import type { Category } from '@/lib/types'

const key = (orgId: string) => `linkboard-category:${orgId}`

function read(orgId: string): string | null {
  try {
    return localStorage.getItem(key(orgId))
  } catch {
    return null
  }
}

/**
 * The category the board is narrowed to. People choose it once ("I'm frontend") and rarely
 * change it, so it is remembered in this browser, per organization, instead of starting at
 * "all" on every visit.
 */
export function useCategoryFilter(orgId: string, categories: Category[]) {
  const [stored, setStored] = useState(() => read(orgId))
  // A remembered category that has been deleted since counts as none.
  const categoryId = categories.some((category) => category.id === stored) ? stored : null

  function setCategoryId(next: string | null) {
    setStored(next)
    try {
      if (next) localStorage.setItem(key(orgId), next)
      else localStorage.removeItem(key(orgId))
    } catch {
      // Without storage the choice lasts until the page is closed.
    }
  }

  return [categoryId, setCategoryId] as const
}
