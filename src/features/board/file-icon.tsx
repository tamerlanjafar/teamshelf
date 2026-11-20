import { File, FileArchive, FileImage, FileSpreadsheet, FileText, FilePlay } from 'lucide-react'
import './link-parts.css'

/** The icon of a file, by its type, where a link has its site's icon. */
export function FileIcon({ type, name }: { type: string | null; name: string | null }) {
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
    <span className="favicon file-icon" aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  )
}
