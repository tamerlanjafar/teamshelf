import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '@/features/requests/requests-page'

export const Route = createFileRoute('/_app/$org/requests')({ component: RequestsPage })
