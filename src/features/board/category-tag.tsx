import type { CSSProperties } from 'react'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'
import './link-parts.css'

/** The name of a category, in its color. `plain`: without the pill around it, for a card's header. */
export function CategoryTag({ category, plain = false }: { category: Category; plain?: boolean }) {
  return (
    <span className={plain ? 'tag is-plain' : 'tag'} style={{ '--t': colorValue(category.color) } as CSSProperties}>
      {category.name}
    </span>
  )
}
