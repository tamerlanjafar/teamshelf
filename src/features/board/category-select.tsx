import { ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'

const ALL = 'all'

const Dot = ({ color }: { color: string }) => <span className="size-2 flex-none rounded-full bg-(--t)" style={{ '--t': color } as CSSProperties} />

/**
 * Narrows the board to one category. One compact button that names the choice and opens the
 * list, so it stays the same size however many categories there are.
 */
export function CategorySelect({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (categoryId: string | null) => void }) {
  if (categories.length === 0) return null
  const selected = categories.find((category) => category.id === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected ? `Category: ${selected.name}` : 'Category: all'}
        className="bg-surface border-line hover:text-ink data-[popup-open]:border-brand flex h-11 max-w-[220px] flex-none items-center gap-2 rounded-xl border pr-3 pl-3.5 transition-colors"
      >
        {selected && <Dot color={colorValue(selected.color)} />}
        <span className={selected ? 'truncate font-medium' : 'text-quiet truncate'}>{selected?.name ?? 'All categories'}</span>
        <ChevronDown className="text-quiet size-4 flex-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="max-h-[60vh] min-w-52 rounded-xl">
        <DropdownMenuRadioGroup value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : (next as string))}>
          <DropdownMenuRadioItem value={ALL} closeOnClick>
            All categories
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {categories.map((category) => (
            <DropdownMenuRadioItem key={category.id} value={category.id} closeOnClick>
              <Dot color={colorValue(category.color)} />
              {category.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
