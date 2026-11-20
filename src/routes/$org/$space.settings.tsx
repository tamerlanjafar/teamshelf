import { createFileRoute } from '@tanstack/react-router'
import { SpaceSettingsPage } from '@/features/spaces/space-settings-page'

/** A space's settings: /<org>/<space>/settings. For its admins. */
export const Route = createFileRoute('/$org/$space/settings')({ component: SpaceSettingsPage })
