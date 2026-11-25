import { Folder as FolderIcon, PanelTop } from 'lucide-react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import type { Folder } from '@/lib/types'
import { cn } from '@/lib/utils'
import { treeOrder } from './folder-tree'

/** One place to choose: the top of the group (no folder), or one of its folders. */
interface Place {
  id: string | null
  /** As the list shows it: the folder's own name, indented under its parent. */
  name: string
  /** As the field shows it once chosen, and what typing matches: its whole path. */
  label: string
  /** 0 for the top of the group, 1 for a folder at its top, and so on. */
  depth: number
}

const samePlace = (a: Place, b: Place) => a.id === b.id

/**
 * Chooses where in a group something goes, like the group field: the top of the group, or one
 * of its folders, listed as a tree (each under its parent, indented). Typing filters by the
 * whole path ("ware" finds Pipelines / Warehouse). `folders` are the group's.
 */
export function FolderSelect({
  id,
  folders,
  groupName,
  value,
  onChange,
  disabled,
  exclude = [],
  className,
}: {
  id: string
  folders: Folder[]
  groupName: string
  value: string | null
  onChange: (folderId: string | null) => void
  disabled?: boolean
  /** Folders that can't be chosen (a folder and what is inside it, when moving it). */
  exclude?: string[]
  className?: string
}) {
  const top: Place = { id: null, name: `Top of ${groupName}`, label: `Top of ${groupName}`, depth: 0 }
  const places: Place[] = [
    top,
    ...treeOrder(folders)
      .filter((choice) => !exclude.includes(choice.folder.id))
      .map((choice) => ({ id: choice.folder.id, name: choice.folder.name, label: choice.path, depth: choice.depth })),
  ]
  const chosen = places.find((place) => place.id === value) ?? top

  return (
    <Combobox<Place>
      items={places}
      value={chosen}
      onValueChange={(place) => place && onChange(place.id)}
      itemToStringLabel={(place) => place.label}
      isItemEqualToValue={samePlace}
      disabled={disabled}
    >
      <ComboboxInput id={id} placeholder="Choose a folder" className={cn('h-10 w-full', className)} />
      <ComboboxContent>
        <ComboboxEmpty>No folder by that name</ComboboxEmpty>
        <ComboboxList>
          {(place: Place) => (
            <ComboboxItem key={place.id ?? 'top'} value={place}>
              <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: Math.max(0, place.depth - 1) * 16 }}>
                {place.id === null ? <PanelTop className="text-quiet size-4 flex-none" aria-hidden="true" /> : <FolderIcon className="text-quiet size-4 flex-none" aria-hidden="true" />}
                <span className="truncate">{place.name}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
