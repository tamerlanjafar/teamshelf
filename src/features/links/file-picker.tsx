import { Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatBytes, MAX_FILE_BYTES } from '@/api/files'
import { FileIcon } from '@/features/board/file-icon'
import { cn } from '@/lib/utils'

/** Where a file is dropped or picked. Shows the chosen file, with a way to take it out again. */
export function FilePicker({ id, file, invalid, disabled, onChange }: { id: string; file: File | null; invalid?: boolean; disabled?: boolean; onChange: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  if (file) {
    return (
      <div className={cn('bg-well flex min-w-0 items-center gap-3 rounded-[10px] px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]', invalid && 'shadow-[inset_0_0_0_1px_var(--danger)]')}>
        <FileIcon type={file.type} name={file.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{file.name}</span>
          <span className="text-quiet block text-[12.5px] tabular-nums">{formatBytes(file.size)}</span>
        </span>
        <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label="Choose another file" className="text-quiet hover:text-ink hover:bg-accent grid size-8 flex-none place-items-center rounded-lg">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        const dropped = event.dataTransfer.files[0]
        if (dropped) onChange(dropped)
      }}
      className={cn(
        'text-quiet hover:text-ink flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border border-dashed px-4 py-6 text-center transition-colors',
        over ? 'border-brand bg-brand/5 text-ink' : invalid ? 'border-danger' : 'border-line',
      )}
    >
      <Upload className="size-5" />
      <span className="text-[14px] font-medium">Drop a file here, or choose one</span>
      <span className="text-[12.5px]">Up to {formatBytes(MAX_FILE_BYTES)}</span>
      <input ref={input} id={id} type="file" className="sr-only" disabled={disabled} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
    </label>
  )
}
