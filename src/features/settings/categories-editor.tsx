import { Plus, Trash2 } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { useAddCategory, useCategories, useDeleteCategory, useUpdateCategory } from '@/api/categories'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/app/color-picker'
import { useConfirm } from '@/components/app/confirm-dialog'
import { TextInput } from '@/components/app/form'
import { colorValue, leastUsedColor } from '@/lib/colors'
import { toastError } from '@/lib/errors'
import type { Category } from '@/lib/types'

/** The organization's list of categories: rename, recolor, delete, and add at the end. */
export function CategoriesEditor() {
  const categories = useCategories()
  const addCategory = useAddCategory()
  const [name, setName] = useState('')

  function add(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const position = Math.max(-1, ...categories.map((category) => category.position)) + 1
    addCategory.mutate({ name, color: leastUsedColor(categories.map((category) => category.color)), position }, { onSuccess: () => setName(''), onError: toastError })
  }

  return (
    <section>
      <h2 className="text-quiet mx-1 mb-1 text-[13px] font-semibold">Categories</h2>
      <p className="text-quiet mx-1 mt-0 mb-2.5 text-[13px] leading-relaxed">What kind of thing a link is, or who it is mostly for. Each link can have one, and the board can be narrowed to one.</p>
      <div className="bg-raised border-line divide-line divide-y overflow-hidden rounded-[14px] border">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
        <form onSubmit={add} className="flex items-center gap-2.5 px-3 py-2.5">
          <TextInput aria-label="New category" placeholder="New category" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" variant="outline" disabled={addCategory.isPending || !name.trim()}>
            <Plus />
            Add
          </Button>
        </form>
      </div>
    </section>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const confirm = useConfirm()
  const [name, setName] = useState(category.name)

  /** Saves the name when the field is left, or puts the old one back if it was emptied. */
  function saveName() {
    const next = name.trim()
    if (!next) return setName(category.name)
    if (next !== category.name) updateCategory.mutate({ id: category.id, name: next }, { onError: (error) => (setName(category.name), toastError(error)) })
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Popover>
        <PopoverTrigger aria-label={`Color of ${category.name}`} className="size-6 flex-none rounded-full" style={{ background: colorValue(category.color) } as CSSProperties} />
        <PopoverContent align="start" className="w-auto rounded-[14px] p-3">
          <ColorPicker size="small" value={category.color} onChange={(color) => updateCategory.mutate({ id: category.id, color }, { onError: toastError })} />
        </PopoverContent>
      </Popover>
      <TextInput
        aria-label="Category name"
        value={name}
        maxLength={30}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        className="bg-transparent shadow-none hover:shadow-[inset_0_0_0_1px_var(--line)]"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${category.name}`}
        className="text-quiet flex-none"
        onClick={() =>
          confirm({
            title: `Delete the category ${category.name}?`,
            description: 'Links in it stay on the board, without a category.',
            confirmLabel: 'Delete category',
            onConfirm: () => deleteCategory.mutate(category.id, { onError: toastError }),
          })
        }
      >
        <Trash2 />
      </Button>
    </div>
  )
}
