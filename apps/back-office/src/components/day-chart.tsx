import { useState } from 'react'
import { cn } from '@/lib/cn'
import { count, day } from '@/lib/format'

/**
 * One number a day, as thin bars from a common baseline: what was new each day of the last
 * month. One series, so no legend: the title says what it is. Pointing at a bar (or moving to it
 * with the keyboard) names its day and number above the chart, and the same numbers are
 * there as a table underneath.
 */
export function DayChart({ title, days, values, unit }: { title: string; days: string[]; values: number[]; /** What is counted, for one and for many: ["link", "links"]. */ unit: [string, string] }) {
  const [pointed, setPointed] = useState<number | null>(null)
  const top = Math.max(1, ...values)
  const total = values.reduce((sum, value) => sum + value, 0)
  const said = (value: number) => `${count(value)} ${value === 1 ? unit[0] : unit[1]}`

  return (
    <section className="bg-surface rounded-2xl border p-4" aria-label={title}>
      <h3 className="m-0 text-[14px] font-semibold">{title}</h3>
      {/* The day being pointed at, or the whole month. */}
      <p className="text-quiet m-0 mt-0.5 text-[13px] tabular-nums" aria-live="polite">
        {pointed === null ? `${said(total)} in 30 days` : `${day(days[pointed])}: ${said(values[pointed])}`}
      </p>

      <div className="relative mt-4">
        {/* The scale: the largest day, as a line across the top. */}
        <div className="border-line text-quiet absolute inset-x-0 top-0 border-t border-dashed text-right text-[11px] leading-none tabular-nums">
          <span className="bg-surface relative -top-1.5 pl-1.5">{count(top)}</span>
        </div>
        <div className="flex h-28 items-end gap-[2px]" onMouseLeave={() => setPointed(null)}>
          {values.map((value, index) => (
            // Each day takes its whole column, so it is easy to point at, also when its bar is short.
            <button
              key={days[index]}
              type="button"
              aria-label={`${day(days[index])}: ${said(value)}`}
              onMouseEnter={() => setPointed(index)}
              onFocus={() => setPointed(index)}
              onBlur={() => setPointed(null)}
              className="group flex h-full min-w-0 flex-1 items-end rounded-sm outline-offset-1"
            >
              <span
                className={cn('block w-full rounded-t-[4px] transition-colors', value === 0 ? 'bg-line' : pointed === index ? 'bg-ink' : 'bg-brand')}
                style={{ height: value === 0 ? 1 : `${Math.max(3, (value / top) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        <div className="border-line text-quiet mt-1.5 flex justify-between border-t pt-1.5 text-[11px] tabular-nums">
          <span>{day(days[0])}</span>
          <span>{day(days[days.length - 1])}</span>
        </div>
      </div>

      <details className="mt-3">
        <summary className="text-quiet hover:text-ink w-fit cursor-pointer text-[12.5px]">Show as a table</summary>
        <table className="mt-2 w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-quiet text-left">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">{title}</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr key={days[index]} className="border-t">
                <td className="py-1">{day(days[index])}</td>
                <td className="py-1 text-right">{count(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
