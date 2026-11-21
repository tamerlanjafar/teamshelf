import { ImageUp } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/errors'
import type { Space } from '@/lib/types'
import { cn } from '@/lib/utils'
import { logoFromImage, SPACE_LOGOS, SpaceLogo } from './space-logo'

/** The app's icons to choose from, in even columns, the chosen one ringed. */
export function LogoPicker({ space, onChange }: { space: Pick<Space, 'logo' | 'color' | 'name'>; onChange: (logo: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5">
      {Object.entries(SPACE_LOGOS).map(([key, { label }]) => {
        const chosen = space.logo === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn('grid aspect-square place-items-center rounded-md transition-shadow', chosen ? 'shadow-[0_0_0_2px_var(--brand)]' : 'hover:bg-ink/5')}
          >
            <SpaceLogo space={{ ...space, logo: key }} className="size-8 rounded-sm" />
          </button>
        )
      })}
    </div>
  )
}

/** Uploading an image as the logo instead of an icon: turned into a small square (logoFromImage). */
export function UploadLogoButton({ onChange, className }: { onChange: (logo: string) => void; className?: string }) {
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
    <>
      <Button type="button" variant="outline" onClick={() => input.current?.click()} className={className}>
        <ImageUp />
        Upload image
      </Button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(event) => upload(event.target.files?.[0])} />
    </>
  )
}
