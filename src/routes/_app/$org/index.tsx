import { createFileRoute } from '@tanstack/react-router'
import { OpenRememberedSpace } from '@/features/spaces/current-space'

/** The organization's address alone opens a space: the one open last in this browser, or the first. */
export const Route = createFileRoute('/_app/$org/')({ component: OpenRememberedSpace })
