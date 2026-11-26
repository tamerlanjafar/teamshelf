import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/features/org/org-context'
import { neon } from '@/lib/neon'
import type { Folder } from '@/lib/types'
import { isUniqueViolation, NONE, unwrap } from './db'

export const foldersKey = (orgId: string) => [orgId, 'folders'] as const
/** Deleting a folder deletes its links with it, so link lists are refreshed too. */
const linksKey = (orgId: string) => [orgId, 'links'] as const

/** The folders of every space this person can see. */
export const foldersQuery = (orgId: string) => queryOptions({ queryKey: foldersKey(orgId), queryFn: () => unwrap<Folder[]>(neon.from('folders').select('*').eq('org_id', orgId)) })

/** The folders, or none while they load. */
export const useFoldersIfLoaded = (): Folder[] => useQuery(foldersQuery(useOrg().id)).data ?? NONE

export const foldersOf = (folders: Folder[], groupId: string | undefined | null) => folders.filter((folder) => folder.group_id === groupId)

/** The database's words for a folder that can't go where it was asked to (see 010_folders.sql), kept as they are. */
async function saving<Result>(run: () => Promise<Result>, name: string): Promise<Result> {
  try {
    return await run()
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(`There is already a folder called ${name.trim()} there.`)
    throw error
  }
}

function useFoldersMutation<Input>(run: (input: Input, orgId: string) => Promise<unknown>) {
  const org = useOrg()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => run(input, org.id),
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: foldersKey(org.id) }), queryClient.invalidateQueries({ queryKey: linksKey(org.id) })]),
  })
}

/** A new folder at the top of a group, or inside one of its folders. The space's admins. */
export function useCreateFolder() {
  return useFoldersMutation(({ spaceId, groupId, parentId, name }: { spaceId: string; groupId: string; parentId: string | null; name: string }, orgId) =>
    saving(() => unwrap<Folder>(neon.from('folders').insert({ org_id: orgId, space_id: spaceId, group_id: groupId, parent_id: parentId, name: name.trim() }).select().single()), name),
  )
}

/** Renames a folder, or moves it into another folder of its group (or to the top: null). */
export function useUpdateFolder() {
  return useFoldersMutation(({ folder, name, parentId }: { folder: Folder; name?: string; parentId?: string | null }) =>
    saving(() => unwrap(neon.from('folders').update({ ...(name !== undefined ? { name: name.trim() } : {}), ...(parentId !== undefined ? { parent_id: parentId } : {}) }).eq('id', folder.id)), name ?? folder.name),
  )
}

/** Deletes a folder, with the folders and links in it (016_folders_delete_contents.sql). */
export function useDeleteFolder() {
  return useFoldersMutation((id: string) => unwrap(neon.from('folders').delete().eq('id', id)))
}
