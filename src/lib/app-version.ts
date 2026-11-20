// Keeps an open tab on the newest deploy. Each build has its own version, baked into the
// bundle as `__APP_VERSION__` and served as /version.json (see vite.config.ts).

const CHECK_EVERY = 15 * 60 * 1000

/** A form is open: reloading now would throw away what the person typed. */
const busy = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null

/**
 * Watches /version.json for a newer deploy and reloads onto it the next time the tab is
 * hidden, so the page never refreshes while someone is looking at it. The board comes from
 * the database and the person's view from their prefs, so the reload loses nothing. The one
 * exception is a half-filled form, and the reload waits for it to close.
 */
export function watchAppVersion() {
  if (import.meta.env.DEV) return // the dev server has no version.json

  let stale = false

  const reloadWhenHidden = () => {
    if (stale && document.visibilityState === 'hidden' && !busy()) window.location.reload()
  }

  const check = async () => {
    if (stale) return
    try {
      const response = await fetch('/version.json', { cache: 'no-store' })
      if (!response.ok) return
      const { version } = (await response.json()) as { version?: string }
      if (version && version !== __APP_VERSION__) {
        stale = true
        reloadWhenHidden()
      }
    } catch {
      // Offline, or a deploy in progress: try again later.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
    else reloadWhenHidden()
  })
  window.setInterval(() => void check(), CHECK_EVERY)
  void check()

  // A chunk failed to load: a deploy replaced this build's files. Reload onto the new build
  // (https://vite.dev/guide/build#load-error-handling).
  window.addEventListener('vite:preloadError', () => window.location.reload())
}
