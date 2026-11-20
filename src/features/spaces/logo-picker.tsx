import { ImageUp } from 'lucide-react'
import { useRef } from 'react'
import { toastError } from '@/lib/errors'
import type { Space } from '@/lib/types'
import { cn } from '@/lib/utils'
import { isImageLogo, logoFromImage, SPACE_LOGOS, SpaceLogo } from './space-logo'

/** The app's logos to choose from, and a button to upload an image instead. */
export function LogoPicker({ space, onChange }: { space: Pick<Space, 'logo' | 'color' | 'name'>; onChange: (logo: string) => void }) {
  const input = useRef<HTMLInputElement>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    try {
      onChange(await logoFromImage(file))
    } catch (error) {
      toastError(error)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div role="radiogroup" aria-label="Logo" className="flex flex-wrap gap-2">
      {Object.entries(SPACE_LOGOS).map(([key, { label }]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={space.logo === key}
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn('rounded-[10px] p-[3px] outline-offset-2 transition-shadow', space.logo === key ? 'shadow-[0_0_0_2px_var(--brand)]' : 'hover:shadow-[0_0_0_1px_var(--line)]')}
        >
          <SpaceLogo space={{ ...space, logo: key }} className="size-8" />
        </button>
      ))}
      {isImageLogo(space.logo) && (
        <span role="radio" aria-checked="true" aria-label="Uploaded image" className="rounded-[10px] p-[3px] shadow-[0_0_0_2px_var(--brand)]">
          <SpaceLogo space={space} className="size-8" />
        </span>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="text-quiet hover:text-ink border-line grid size-[38px] place-items-center rounded-[10px] border border-dashed"
        aria-label="Upload an image"
        title="Upload an image"
      >
        <ImageUp className="size-4" />
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(event) => upload(event.target.files?.[0])} />
    </div>
  )
}
