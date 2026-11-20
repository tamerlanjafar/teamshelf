import { ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'

const Dot = ({ color }: { color: string }) => <span className="size-2 flex-none rounded-full bg-(--t)" style={{ '--t': color } as CSSProperties} />

/**
 * Narrows the board to one or more categories. One compact button that names the choice and
 * opens the list. It has a fixed width, so the bar doesn't shift as the choice changes (a long
 * name is cut off with an ellipsis). The list stays open while you tick several.
 */
export function CategorySelect({ categories, value, onChange }: { categories: Category[]; value: string[]; onChange: (categoryIds: string[]) => void }) {
  if (categories.length === 0) return null
  const selected = categories.filter((category) => value.includes(category.id))
  const label = selected.length === 0 ? 'All categories' : selected.length === 1 ? selected[0].name : `${selected.length} categories`

  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((other) => other !== id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected.length ? `Categories: ${selected.map((category) => category.name).join(', ')}` : 'Categories: all'}
        className="bg-surface border-line hover:text-ink data-[popup-open]:border-brand flex h-11 w-[176px] flex-none items-center gap-2 rounded-xl border pr-3 pl-3.5 text-left transition-colors"
      >
        {selected.length > 0 && (
          <span className="flex flex-none -space-x-0.5">
            {selected.slice(0, 3).map((category) => (
              <Dot key={category.id} color={colorValue(category.color)} />
            ))}
          </span>
        )}
        <span className={selected.length ? 'min-w-0 flex-1 truncate font-medium' : 'text-quiet min-w-0 flex-1 truncate'}>{label}</span>
        <ChevronDown className="text-quiet size-4 flex-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="max-h-[60vh] min-w-[176px] rounded-xl">
        {categories.map((category) => (
          <DropdownMenuCheckboxItem key={category.id} checked={value.includes(category.id)} onCheckedChange={(checked) => toggle(category.id, checked)}>
            <Dot color={colorValue(category.color)} />
            {category.name}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={selected.length === 0} onClick={() => onChange([])}>
          Show all categories
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
