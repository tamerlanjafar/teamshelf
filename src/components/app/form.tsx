import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A label above a control, with an optional hint or error below it. */
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {error ? <span className="text-danger text-[12.5px]">{error}</span> : hint ? <span className="text-quiet text-[12.5px] leading-snug">{hint}</span> : null}
    </label>
  )
}

const CONTROL =
  'bg-well text-ink placeholder:text-quiet/80 h-9 w-full min-w-0 rounded-[9px] px-3 shadow-[inset_0_0_0_1px_var(--line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--brand)] aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)]'

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input autoComplete="off" spellCheck={false} className={cn(CONTROL, className)} {...props} />
}

export interface SegmentedOption<Value extends string> {
  value: Value
  label: ReactNode
}

/** Several choices side by side, one chosen. */
export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: SegmentedOption<Value>[]
  value: Value
  onChange: (value: Value) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('bg-well inline-flex flex-none gap-0.5 rounded-[10px] p-[3px] shadow-[inset_0_0_0_1px_var(--line)]', className)}>
      {options.map((option) => {
        const chosen = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-[7px] px-3 py-[5px] whitespace-nowrap transition-colors',
              chosen ? 'bg-chip text-ink font-medium shadow-[0_1px_2px_rgba(0,0,0,0.18),0_0_0_1px_var(--line)]' : 'text-quiet hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
