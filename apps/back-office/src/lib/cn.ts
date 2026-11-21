/** Joins class names, leaving out the ones that are switched off. */
export const cn = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')
