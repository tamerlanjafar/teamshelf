import { Link } from '@tanstack/react-router'
import { DayChart } from '@/components/day-chart'
import { PageHead, Stat } from '@/components/parts'
import { ago, bytes, count } from '@/lib/format'
import { useReport } from '@/shell'

const lately = (value: number) => (value > 0 ? `+${count(value)} in 30 days` : 'None new in 30 days')

/** Where things stand, and what the last month added. */
export function Overview() {
  const { totals, days, orgs } = useReport()
  const dates = days.map((one) => one.day)
  const active = [...orgs].sort((a, b) => b.last_active.localeCompare(a.last_active)).slice(0, 5)

  return (
    <>
      <PageHead title="Overview" lead="Every organization of this Teamshelf, in numbers." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Organizations" value={count(totals.orgs)} note={lately(totals.orgs_30d)} />
        <Stat label="People" value={count(totals.people)} note={`${lately(totals.people_30d)}${totals.invited ? ` · ${count(totals.invited)} invited` : ''}`} />
        <Stat label="Links and files" value={count(totals.links + totals.files)} note={lately(totals.links_30d)} />
        <Stat label="File storage" value={bytes(totals.file_bytes)} note={`${count(totals.files)} ${totals.files === 1 ? 'file' : 'files'}`} />
        <Stat label="Spaces" value={count(totals.spaces)} />
        <Stat label="Waiting for review" value={count(totals.waiting)} note="Suggestions no admin has answered" />
      </div>

      <h2 className="mt-9 mb-3 text-[16px] font-semibold">The last 30 days</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <DayChart title="New organizations" unit={['organization', 'organizations']} days={dates} values={days.map((one) => one.orgs)} />
        <DayChart title="People who joined" unit={['person', 'people']} days={dates} values={days.map((one) => one.people)} />
        <DayChart title="Links and files added" unit={['link or file', 'links and files']} days={dates} values={days.map((one) => one.links)} />
      </div>

      <div className="mt-9 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold">Active lately</h2>
        <Link to="/organizations" className="text-brand text-[13px] font-medium hover:underline">
          All organizations
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="text-quiet bg-surface m-0 rounded-2xl border p-4">No organization yet.</p>
      ) : (
        <ul className="bg-surface m-0 list-none divide-y rounded-2xl border p-0">
          {active.map((org) => (
            <li key={org.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{org.name}</span>
              <span className="text-quiet flex-none text-[13px] tabular-nums">
                {count(org.people)} {org.people === 1 ? 'person' : 'people'} · {count(org.links + org.files)} links and files
              </span>
              <span className="text-quiet w-24 flex-none text-right text-[13px]">{ago(org.last_active)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
