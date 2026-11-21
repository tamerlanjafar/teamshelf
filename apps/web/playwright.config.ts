import { defineConfig, devices } from '@playwright/test'

// End-to-end tests (e2e/). They run against mock mode, the real app with made-up data in the
// browser (src/mock): nothing reaches Neon, R2 or email, and every screen can be set up exactly.
// Playwright starts the server itself.
const PORT = 3014

/** The address the tested site says it is served at (canonical links, robots.txt). */
export const SITE_URL = 'https://teamshelf.example.com'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm exec vite --mode mock --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    env: { VITE_SITE_URL: SITE_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
