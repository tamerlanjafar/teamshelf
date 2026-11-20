import { ChevronDown } from 'lucide-react'
import { useCategoriesIfLoaded, useCategoryManagersIfLoaded, useSetManagedCategories } from '@/api/categories'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CategoryTag } from '@/features/board/category-tag'
import { toastError } from '@/lib/errors'
import { displayName } from '@/lib/roles'
import type { Member } from '@/lib/types'

/**
 * The categories a person manages, and a list to change them. In a category they manage,
 * a person adds links straight to the board, edits and deletes links, and reviews suggestions.
 */
export function ManagedCategories({ member }: { member: Member }) {
  const categories = useCategoriesIfLoaded()
  const managers = useCategoryManagersIfLoaded()
  const setManaged = useSetManagedCategories()

  const managedIds = managers.filter((row) => row.member_id === member.id).map((row) => row.category_id)
  const managed = categories.filter((category) => managedIds.includes(category.id))

  const toggle = (categoryId: string, on: boolean) =>
    setManaged.mutate({ memberId: member.id, categoryIds: on ? [...managedIds, categoryId] : managedIds.filter((id) => id !== categoryId) }, { onError: toastError })

  if (categories.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Categories ${displayName(member)} manages`}
        className="hover:bg-accent data-[popup-open]:bg-accent text-quiet -ml-1.5 flex min-h-7 max-w-full flex-wrap items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[12.5px]"
      >
        {managed.length === 0 ? 'Manages no category' : 'Manages'}
        {managed.map((category) => (
          <CategoryTag key={category.id} category={category} />
        ))}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 rounded-[14px] p-1.5">
        <p className="text-quiet m-0 px-2 pt-1.5 pb-2 text-[12.5px] leading-snug">In a category they manage, {displayName(member)} adds, edits and reviews links.</p>
        {categories.map((category) => (
          <label key={category.id} className="hover:bg-accent flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Checkbox checked={managedIds.includes(category.id)} disabled={setManaged.isPending} onCheckedChange={(checked) => toggle(category.id, checked === true)} />
            <span className="min-w-0 flex-1 truncate">{category.name}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}
