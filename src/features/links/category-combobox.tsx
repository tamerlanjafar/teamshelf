import type { CSSProperties } from 'react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { colorValue } from '@/lib/colors'
import type { Category } from '@/lib/types'

/** Chooses a link's category from the organization's list. Clearing it leaves the link without one, unless `required`. */
export function CategoryCombobox({ id, categories, value, required = false, onChange }: { id: string; categories: Category[]; value: string | null; required?: boolean; onChange: (categoryId: string | null) => void }) {
  const selected = categories.find((category) => category.id === value) ?? null

  return (
    <Combobox
      items={categories}
      value={selected}
      itemToStringLabel={(category: Category) => category.name}
      isItemEqualToValue={(a: Category, b: Category) => a.id === b.id}
      onValueChange={(category: Category | null) => {
        if (category || !required) onChange(category?.id ?? null)
      }}
    >
      <ComboboxInput id={id} placeholder="Select a category" showClear={!required && selected !== null} className="h-10 w-full" />
      <ComboboxContent>
        <ComboboxEmpty>No category matches</ComboboxEmpty>
        <ComboboxList>
          {(category: Category) => (
            <ComboboxItem key={category.id} value={category}>
              <span className="size-2 flex-none rounded-full bg-(--t)" style={{ '--t': colorValue(category.color) } as CSSProperties} />
              {category.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
