/** Where the site is served, without a slash at the end. Set in vite.config.ts, read by src/lib/site.ts. */
declare const __SITE_URL__: string

/** This build's version. Set in vite.config.ts, read by src/lib/app-version.ts. */
declare const __APP_VERSION__: string

/** Mock mode only: the script that gives each tab its own mock world. Empty in every other build. */
declare const __MOCK_TAB_SCRIPT__: string
