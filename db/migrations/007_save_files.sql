-- Text files (notes, Markdown documents) can be edited in the app. The new contents are written
-- over the same file in storage, so the link, its address and who sees it stay as they are.
--
-- Called by the server (netlify/lib/files-api.mjs, as the person saving) before it signs an
-- address to write the file to: only an admin of the link's space may, as for any other change
-- to a link. It also records the new size, which the board shows.

create function public.save_file(file text, size bigint) returns void
    language plpgsql security definer
    set search_path to ''
    as $$
declare
    link public.links;
begin
    select * into link from public.links l where l.file_key = file;
    -- The same answer for a file that isn't there and one this person may not change.
    if link.id is null or not app.is_space_admin(link.space_id) then
        raise exception 'Only the admins of a space can change its files.' using errcode = '42501';
    end if;
    if size is null or size < 0 or size > 26214400 then
        raise exception 'Files can be up to 25 MB.' using errcode = '22023';
    end if;
    update public.links set file_size = size where id = link.id;
end
$$;

revoke all on function public.save_file(text, bigint) from public;
grant execute on function public.save_file(text, bigint) to authenticated;
