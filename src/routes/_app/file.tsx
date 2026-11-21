import { createFileRoute } from '@tanstack/react-router'
import { privateHead } from '@/lib/site'
import { useEffect, useState } from 'react'
import { fileUrl, startDownload } from '@/api/files'
import { Button, buttonVariants } from '@/components/ui/button'
import { RequireSession } from '@/features/auth/require-session'
import { AUTH_BUTTON, AUTH_SECONDARY, AuthCard, LoadFailed, Splash } from '@/features/auth/screens'
import { errorMessage } from '@/lib/errors'

/** A file's own address: /file?key=<key>. Signs in if needed, then downloads the file. */
export const Route = createFileRoute('/_app/file')({
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
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!key) return
    fileUrl(key).then(
      (url) => {
        startDownload(url)
        setStarted(true)
      },
      (failure) => setError(errorMessage(failure)),
    )
  }, [key])

  if (error) return <LoadFailed message={error} onRetry={() => window.location.reload()} />
  if (!started) return <Splash />
  // The file is saved to disk, so this page stays: it says so, and offers the way on.
  return (
    <AuthCard title="Your download has started" description="The file is being saved to your downloads. If nothing happened, download it again.">
      <Button size="lg" className={AUTH_BUTTON} onClick={() => window.location.reload()}>
        Download again
      </Button>
      <a href="/" className={buttonVariants({ variant: 'outline', size: 'lg', className: AUTH_SECONDARY })}>
        Open Teamshelf
      </a>
    </AuthCard>
  )
}
