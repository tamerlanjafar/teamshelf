// Features that are built but not switched on yet. Set the variable in .env to try one.

export const FEATURES = {
  /**
   * Everyone can drag groups and links into an order of their own, which only they see.
   * While this is off, only a space's admins reorder, and that order is everyone's.
   * (VITE_PERSONAL_ORDER=true)
   */
  personalOrder: import.meta.env.VITE_PERSONAL_ORDER === 'true',
}
