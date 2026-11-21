import { cloneElement, isValidElement, useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A label above a control, with an optional hint or error below it. Only the label focuses the
 * control (it is linked to it by id, given to the control here unless it has one), so clicking
 * the hint, or hovering anywhere in the field, doesn't reach a button inside the control.
 */
export function Field({ label, hint, error, children, className, id: given }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; /** The control's id, when it sits inside a wrapper (the label can't find it by itself then). */ id?: string }) {
  const generated = useId()
  const control = !given && isValidElement<{ id?: string }>(children) ? children : null
  const id = given ?? control?.props.id ?? generated
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="w-fit text-[13px] font-medium">
        {label}
      </label>
      {control ? cloneElement(control, { id }) : children}
      {error ? <span className="text-danger text-[12.5px]">{error}</span> : hint ? <span className="text-quiet text-[12.5px] leading-snug">{hint}</span> : null}
    </div>
  )
}

const CONTROL =
  'bg-well text-ink placeholder:text-quiet/80 h-9 w-full min-w-0 rounded-md px-3 shadow-[inset_0_0_0_1px_var(--line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--brand)] aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)]'

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input autoComplete="off" spellCheck={false} className={cn(CONTROL, className)} {...props} />
}

export interface SegmentedOption<Value extends string> {
  value: Value
  label: ReactNode
  /** Shown, but can't be chosen. */
  disabled?: boolean
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
    <div role="radiogroup" aria-label={label} className={cn('bg-well inline-flex flex-none gap-0.5 rounded-md p-[3px] shadow-[inset_0_0_0_1px_var(--line)]', className)}>
      {options.map((option) => {
        const chosen = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              // The same weight chosen or not, so choosing one never moves the others.
              'flex-1 rounded-xs px-3 py-[5px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
              chosen ? 'bg-chip text-ink shadow-[0_1px_2px_rgba(0,0,0,0.18),0_0_0_1px_var(--line)]' : 'text-quiet hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
