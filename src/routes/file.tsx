import { createFileRoute } from '@tanstack/react-router'
import { privateHead } from '@/lib/site'
import { useEffect, useState } from 'react'
import { fileUrl } from '@/api/files'
import { RequireSession } from '@/features/auth/require-session'
import { LoadFailed, Splash } from '@/features/auth/screens'
import { errorMessage } from '@/lib/errors'

/** A file's own address: /file?key=<key>. Signs in if needed, then goes to the file itself. */
export const Route = createFileRoute('/file')({
  ssr: false,
  head: () => privateHead(),
  validateSearch: (search): { key?: string } => ({ key: typeof search.key === 'string' ? search.key : undefined }),
  component: OpenFile,
})

function OpenFile() {
  return (
    <RequireSession>
      <GoToFile />
    </RequireSession>
  )
}

function GoToFile() {
  const { key } = Route.useSearch()
  const [error, setError] = useState<string | null>(key ? null : 'This address is missing the file.')

  useEffect(() => {
    if (!key) return
    fileUrl(key).then(
      (url) => window.location.replace(url),
      (failure) => setError(errorMessage(failure)),
    )
  }, [key])

  return error ? <LoadFailed message={error} onRetry={() => window.location.reload()} /> : <Splash />
}
