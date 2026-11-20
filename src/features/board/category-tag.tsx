import type { CSSProperties } from 'react'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'
import './link-parts.css'

/** The name of a link's category, in the category's color. */
export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="tag" style={{ '--t': colorValue(category.color) } as CSSProperties}>
      {category.name}
    </span>
  )
}
