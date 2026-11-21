import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/features/landing/landing-page'

/** teamshelf.app: the front page, for everyone. The app itself opens from it (/open). */
export const Route = createFileRoute('/')({ component: LandingPage })
