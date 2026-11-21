import { File, FileArchive, FileImage, FileSpreadsheet, FileText, FilePlay } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The icon of a file, by its type, where a link has its site's icon. */
export function FileIcon({ type, name, className }: { type: string | null; name: string | null; className?: string }) {
  const kind = `${type ?? ''} ${name ?? ''}`.toLowerCase()
  const Icon = /image\/|\.(png|jpe?g|gif|webp|svg|fig|sketch)\b/.test(kind)
    ? FileImage
    : /video\/|\.(mp4|mov|webm)\b/.test(kind)
      ? FilePlay
      : /spreadsheet|excel|csv|\.(xlsx?|csv|numbers)\b/.test(kind)
        ? FileSpreadsheet
        : /zip|compressed|\.(zip|rar|7z|tar|gz)\b/.test(kind)
          ? FileArchive
          : /pdf|text|word|document|presentation|\.(pdf|docx?|txt|md|pptx?|key)\b/.test(kind)
            ? FileText
            : File
  return (
    // Drawn in the card's color (--c), where a link has its site's icon.
    <span className={cn('favicon grid size-4 flex-none place-items-center text-[color-mix(in_srgb,var(--c,var(--quiet))_75%,var(--ink))] [&_svg]:size-4', className)} aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  )
}
