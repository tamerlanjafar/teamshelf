import { Check } from 'lucide-react'
import { COLOR_NAMES, COLORS } from '@/lib/colors'
import type { Color } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The ten colors, one chosen (or none yet). */
export function ColorPicker({ value, onChange, size = 'default' }: { value: Color | undefined; onChange: (color: Color) => void; size?: 'default' | 'small' }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2 sm:flex-nowrap">
      {COLOR_NAMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          aria-label={option}
          onClick={() => onChange(option)}
          style={{ background: COLORS[option] }}
          className={cn('grid place-items-center rounded-full text-white transition-transform hover:scale-110', size === 'small' ? 'size-6' : 'size-8')}
        >
          {option === value && <Check className={size === 'small' ? 'size-3' : 'size-4'} strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
