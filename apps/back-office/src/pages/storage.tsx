import { PageHead, Stat, Storage } from '@/components/parts'
import { bytes, count } from '@/lib/format'
import { ORG_LIMIT, SPACE_LIMIT } from '@/report'
import { useReport } from '@/shell'

/** Who keeps how many files: each organization against its limit, and the fullest spaces against theirs. */
export function FileStorage() {
  const { totals, orgs, spaces } = useReport()
  const withFiles = orgs.filter((org) => org.file_bytes > 0).sort((a, b) => b.file_bytes - a.file_bytes)
  const nearlyFull = withFiles.filter((org) => org.file_bytes >= ORG_LIMIT * 0.8).length

  return (
    <>
      <PageHead title="File storage" lead={`An organization may keep ${bytes(ORG_LIMIT)} of files, a space ${bytes(SPACE_LIMIT)}.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Stored in all" value={bytes(totals.file_bytes)} note={`${count(totals.files)} ${totals.files === 1 ? 'file' : 'files'}`} />
        <Stat label="Organizations with files" value={count(withFiles.length)} note={`of ${count(orgs.length)}`} />
        <Stat label="Nearly full" value={count(nearlyFull)} note="At 80% of their limit, or more" />
      </div>

      <h2 className="mt-9 mb-3 text-[16px] font-semibold">By organization</h2>
      {withFiles.length === 0 ? (
        <p className="text-quiet bg-surface m-0 rounded-2xl border p-4">Nobody has uploaded a file yet.</p>
      ) : (
        <div className="bg-surface grid gap-5 rounded-2xl border p-4">
          {withFiles.map((org) => (
            <Storage key={org.id} label={org.name} used={org.file_bytes} limit={ORG_LIMIT} />
          ))}
        </div>
      )}

      {spaces.length > 0 && (
        <>
          <h2 className="mt-9 mb-3 text-[16px] font-semibold">The fullest spaces</h2>
          <div className="bg-surface grid gap-5 rounded-2xl border p-4">
            {spaces.map((space) => (
              <Storage key={`${space.org}/${space.space}`} label={`${space.org} › ${space.space}`} used={space.file_bytes} limit={SPACE_LIMIT} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
