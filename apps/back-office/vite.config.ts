import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { authProxyDevServer } from '@teamshelf/auth-proxy/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** .env is kept once, at the top of the repository. */
const ENV_DIR = fileURLToPath(new URL('../..', import.meta.url))
const file = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(({ command, mode }) => {
  // Demo mode (`pnpm dev:demo`): made-up numbers and no sign-in, to look at the screens and test them.
  const demo = mode === 'demo'
  const env = { ...loadEnv(mode, ENV_DIR, ''), ...process.env }
  if (command === 'build' && !demo && !(env.VITE_NEON_AUTH_URL && env.VITE_NEON_DATA_API_URL)) {
    throw new Error('VITE_NEON_AUTH_URL and VITE_NEON_DATA_API_URL are not set. Run `pnpm cloud` (see SETUP.md), or set them where the site is built.')
  }
  return {
    envDir: ENV_DIR,
    plugins: [react(), tailwindcss(), ...(demo ? [] : [authProxyDevServer(env.VITE_NEON_AUTH_URL ?? '')])],
    resolve: {
      alias: [
        // Where sign-in and the report come from: Neon, or the demo's made-up data.
        { find: '@/backend', replacement: file(demo ? './src/backend/demo.ts' : './src/backend/neon.ts') },
        { find: '@', replacement: file('./src') },
      ],
    },
    server: { port: demo ? 3016 : 3015, strictPort: true },
  }
})
