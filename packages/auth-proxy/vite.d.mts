import type { Plugin } from 'vite'

/** Serves /api/auth/* from a Vite dev server, as the deployed site's function does. */
export function authProxyDevServer(neonAuthUrl: string | (() => string)): Plugin
