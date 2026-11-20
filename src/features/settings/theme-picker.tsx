import { Check } from 'lucide-react'
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follows your device' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
]

/** How Teamshelf looks in this browser: three small pictures of the board, one chosen. */
export function ThemePicker() {
  const theme = useTheme()
  return (
    <section>
      <h2 className="text-quiet mx-1 mb-2.5 text-[13px] font-semibold">Appearance</h2>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {OPTIONS.map((option) => {
          const chosen = option.value === theme
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => setTheme(option.value)}
              className={cn(
                'bg-raised group rounded-[16px] border p-2 text-left transition-[border-color,box-shadow]',
                chosen ? 'border-brand shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_20%,transparent)]' : 'border-line hover:border-[color-mix(in_srgb,var(--ink)_22%,transparent)]',
              )}
            >
              <Preview choice={option.value} />
              <span className="flex items-center gap-2 px-1.5 pt-2.5 pb-1">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{option.label}</span>
                  <span className="text-quiet block truncate text-[12.5px]">{option.hint}</span>
                </span>
                <span className={cn('grid size-5 flex-none place-items-center rounded-full', chosen ? 'bg-brand text-on-brand' : 'border-line border')}>
                  {chosen && <Check className="size-3" strokeWidth={3} />}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const LIGHT = { page: '#f2f3f7', surface: '#ffffff', bar: '#d9dce6' }
const DARK = { page: '#0d0e13', surface: '#1c1e27', bar: '#3a3e4f' }
const TINTS = ['#337afa', '#33bd66', '#fa8c29']

/** A tiny board in the given theme. "System" shows half of each. */
function Preview({ choice }: { choice: ThemeChoice }) {
  return (
    <span aria-hidden="true" className="border-line relative block aspect-[16/10] overflow-hidden rounded-[10px] border">
      <MiniBoard colors={choice === 'dark' ? DARK : LIGHT} />
      {choice === 'system' && (
        <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <MiniBoard colors={DARK} />
        </span>
      )}
    </span>
  )
}

function MiniBoard({ colors }: { colors: typeof LIGHT }) {
  return (
    <span className="absolute inset-0 flex flex-col gap-[7%] p-[8%]" style={{ background: colors.page }}>
      <span className="h-[14%] w-3/5 rounded-full" style={{ background: colors.bar }} />
      <span className="flex flex-1 gap-[6%]">
        {TINTS.map((tint, index) => (
          <span
            key={tint}
            className="flex-1 rounded-[5px]"
            style={{ background: `color-mix(in srgb, ${tint} 22%, ${colors.surface})`, height: `${[100, 62, 82][index]}%`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 30%, transparent)` }}
          />
        ))}
      </span>
    </span>
  )
}
