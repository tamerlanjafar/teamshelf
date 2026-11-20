import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import type { Category, CategoryManager, Color } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'

const categoriesKey = (orgId: string) => [orgId, 'categories'] as const

export const categoriesQuery = (orgId: string) =>
  queryOptions({
    queryKey: categoriesKey(orgId),
    queryFn: () => unwrap<Category[]>(neon.from('categories').select('*').eq('org_id', orgId).order('position').order('name')),
  })

/** The organization's categories. Suspends until they are loaded: use it inside a <Section>. */
export const useCategories = () => useSuspenseQuery(categoriesQuery(useOrg().id)).data

/** The categories, or none while they load. */
export const useCategoriesIfLoaded = (): Category[] => useQuery(categoriesQuery(useOrg().id)).data ?? NONE

function useCategoriesMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Input) => {
      try {
        return await run(input)
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('There is already a category with that name.')
        throw error
      }
    },
    // Links carry their category, so they are refreshed too.
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: categoriesKey(org.id) }), queryClient.invalidateQueries({ queryKey: [org.id, 'links'] })]),
  })
}

// All three: super admin only.

export function useAddCategory() {
  const org = useOrg()
  return useCategoriesMutation(({ name, color, position }: { name: string; color: Color; position: number }) =>
    unwrap(neon.from('categories').insert({ org_id: org.id, name: name.trim(), color, position })),
  )
}

export function useUpdateCategory() {
  return useCategoriesMutation(({ id, ...changes }: { id: string; name?: string; color?: Color }) =>
    unwrap(neon.from('categories').update(changes).eq('id', id)),
  )
}

export function useDeleteCategory() {
  return useCategoriesMutation((id: string) => unwrap(neon.from('categories').delete().eq('id', id)))
}

const managersKey = (orgId: string) => [orgId, 'category-managers'] as const

export const categoryManagersQuery = (orgId: string) =>
  queryOptions({
    queryKey: managersKey(orgId),
    queryFn: async (): Promise<CategoryManager[]> => {
      const rows = await unwrap<CategoryManager[]>(neon.from('category_managers').select('category_id, member_id, categories!inner(org_id)').eq('categories.org_id', orgId))
      return rows.map(({ category_id, member_id }) => ({ category_id, member_id }))
    },
  })

/** Who manages which category in this organization, or nobody while that loads. */
export const useCategoryManagersIfLoaded = (): CategoryManager[] => useQuery(categoryManagersQuery(useOrg().id)).data ?? NONE

/** Sets the categories one person manages. Admins and the super admin. */
export function useSetManagedCategories() {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, categoryIds }: { memberId: string; categoryIds: string[] }) => {
      const current = (queryClient.getQueryData<CategoryManager[]>(managersKey(org.id)) ?? []).filter((row) => row.member_id === memberId).map((row) => row.category_id)
      const removed = current.filter((id) => !categoryIds.includes(id))
      const added = categoryIds.filter((id) => !current.includes(id))
      if (removed.length) await unwrap(neon.from('category_managers').delete().eq('member_id', memberId).in('category_id', removed))
      if (added.length) await unwrap(neon.from('category_managers').insert(added.map((category_id) => ({ category_id, member_id: memberId }))))
    },
    // What a person may do to links follows from this, so links are refreshed too.
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: managersKey(org.id) }), queryClient.invalidateQueries({ queryKey: [org.id, 'links'] })]),
  })
}
