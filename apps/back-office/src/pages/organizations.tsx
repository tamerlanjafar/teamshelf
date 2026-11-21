import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHead } from '@/components/parts'
import { ago, bytes, count, day } from '@/lib/format'
import type { OrgRow } from '@/report'
import { useReport } from '@/shell'

type Column = 'name' | 'people' | 'spaces' | 'links' | 'file_bytes' | 'created_at' | 'last_active'

const COLUMNS: { id: Column; label: string; numeric?: boolean }[] = [
  { id: 'name', label: 'Organization' },
  { id: 'people', label: 'People', numeric: true },
  { id: 'spaces', label: 'Spaces', numeric: true },
  { id: 'links', label: 'Links and files', numeric: true },
  { id: 'file_bytes', label: 'Storage', numeric: true },
  { id: 'created_at', label: 'Created' },
  { id: 'last_active', label: 'Last active' },
]

const sortValue = (org: OrgRow, column: Column) => (column === 'links' ? org.links + org.files : org[column])

/** Every organization, to search and to sort by any column. */
export function Organizations() {
  const { orgs } = useReport()
  const [query, setQuery] = useState('')
  // Names start A to Z, everything else starts with the most, or the latest.
  const [sort, setSort] = useState<{ column: Column; down: boolean }>({ column: 'last_active', down: true })

  const words = query.trim().toLowerCase()
  const rows = orgs
    .filter((org) => !words || `${org.name} ${org.slug} ${org.owner ?? ''}`.toLowerCase().includes(words))
    .sort((a, b) => {
      const [x, y] = [sortValue(a, sort.column), sortValue(b, sort.column)]
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.down ? -order : order
    })

  return (
    <>
      <PageHead title="Organizations" lead={`${count(orgs.length)} in all.`}>
        <label className="bg-surface flex h-10 w-full items-center gap-2 rounded-lg border px-3 sm:w-64">
          <Search className="text-quiet size-4 flex-none" />
          <input aria-label="Search organizations" placeholder="Search by name or owner" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
      </PageHead>

      <div className="bg-surface overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const sorted = sort.column === column.id
                return (
                  <th key={column.id} aria-sort={sorted ? (sort.down ? 'descending' : 'ascending') : undefined} className={column.numeric ? 'text-right' : 'text-left'}>
                    <button
                      type="button"
                      onClick={() => setSort({ column: column.id, down: sorted ? !sort.down : column.id !== 'name' })}
                      className={`text-quiet hover:text-ink inline-flex items-center gap-1 px-4 py-3 text-[12.5px] font-medium ${sorted ? 'text-ink!' : ''}`}
                    >
                      {column.label}
                      {sorted && (sort.down ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((org) => (
              <tr key={org.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-quiet text-[12.5px]">
                    /{org.slug}
                    {org.owner && ` · ${org.owner}`}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {count(org.people)}
                  {org.invited > 0 && <div className="text-quiet text-[12.5px]">+{count(org.invited)} invited</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{count(org.spaces)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {count(org.links + org.files)}
                  {org.waiting > 0 && <div className="text-quiet text-[12.5px]">{count(org.waiting)} waiting</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{bytes(org.file_bytes)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{day(org.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{ago(org.last_active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-quiet m-0 border-t px-4 py-6 text-center">{orgs.length === 0 ? 'No organization yet.' : `Nothing matches “${query.trim()}”.`}</p>}
      </div>
    </>
  )
}
