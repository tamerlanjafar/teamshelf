import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import type { Group } from '@/lib/types'

/**
 * Chooses the group a link goes into: pick one of the existing groups, or type a name that
 * isn't there yet to start a new one. The value is the group's name.
 */
export function GroupCombobox({ id, groups, value, invalid, autoFocus, onChange }: { id: string; groups: Group[]; value: string; invalid?: boolean; autoFocus?: boolean; onChange: (name: string) => void }) {
  const names = groups.map((group) => group.name).sort((a, b) => a.localeCompare(b))
  const typed = value.trim()
  const isNew = typed !== '' && !names.some((name) => name.toLowerCase() === typed.toLowerCase())
  // A name that doesn't exist yet is offered as the last choice, to create it.
  const items = isNew ? [...names, typed] : names

  return (
    <Combobox items={items} value={names.find((name) => name.toLowerCase() === typed.toLowerCase()) ?? (isNew ? typed : null)} inputValue={value} onInputValueChange={onChange} onValueChange={(name) => onChange(name ?? '')}>
      <ComboboxInput id={id} placeholder="Select or create a group" aria-invalid={invalid} autoFocus={autoFocus} maxLength={60} className="h-10 w-full" />
      <ComboboxContent>
        <ComboboxEmpty>Type a name to create a group</ComboboxEmpty>
        <ComboboxList>
          {(name: string) => (
            <ComboboxItem key={name} value={name}>
              {isNew && name === typed ? (
                <span>
                  Create <span className="font-medium">“{name}”</span>
                </span>
              ) : (
                name
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
