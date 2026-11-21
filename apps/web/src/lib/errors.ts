import { toast } from '@/components/ui/toast'

/** The message of anything that was thrown. */
export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong.')

/** For `onError` of a mutation: say what went wrong. */
export const toastError = (error: unknown) => toast.error(errorMessage(error))
