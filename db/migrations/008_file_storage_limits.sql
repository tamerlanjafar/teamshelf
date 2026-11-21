-- Teamshelf keeps a team's documents, it isn't a drive: a space holds up to 250 MB of files, and
-- an organization up to 1 GB across its spaces. Counted are the files on links (also the ones
-- waiting for review), and uploads that were started and haven't become a link yet.

create function app.files_stored(org uuid, space uuid default null) returns bigint
    language sql stable security definer
    set search_path to ''
    as $$
    select coalesce((
        select sum(l.file_size) from public.links l
        where l.org_id = org and l.file_key is not null and (space is null or l.space_id = space)
    ), 0) + coalesce((
        select sum(u.file_size) from public.file_uploads u
        where u.org_id = org
            and (space is null or u.file_key like org || '/' || space || '/%')
            and not exists (select 1 from public.links l where l.file_key = u.file_key)
    ), 0)
$$;

revoke all on function app.files_stored(uuid, uuid) from public;

-- Raises when `more` bytes would take the space or its organization over its limit.
create function app.check_file_room(org uuid, space uuid, more bigint) returns void
    language plpgsql stable security definer
    set search_path to ''
    as $$
begin
    if app.files_stored(org, space) + more > 262144000 then
        raise exception 'This space has used its 250 MB for files. Delete files it no longer needs, or use a link instead.' using errcode = 'P0001';
    end if;
    if app.files_stored(org) + more > 1073741824 then
        raise exception 'This organization has used its 1 GB for files. Delete files it no longer needs, or use a link instead.' using errcode = 'P0001';
    end if;
end
$$;

revoke all on function app.check_file_room(uuid, uuid, bigint) from public;

create or replace function public.start_upload(space uuid, file_name text, size bigint) returns text
    language plpgsql security definer
    set search_path to ''
    as $$
declare
    org uuid;
    me uuid;
    key text;
begin
    select s.org_id into org from public.spaces s where s.id = space;
    -- Seeing the space is what it takes to add to it (an admin publishes, everyone else suggests).
    if org is null or not app.can_see_space(space) then
        raise exception 'You can''t add files to this space.' using errcode = '42501';
    end if;
    me := app.member_id(org);
    if size is null or size <= 0 or size > 26214400 then
        raise exception 'Files can be up to 25 MB.' using errcode = '22023';
    end if;
    if file_name is null or file_name !~ '^[A-Za-z0-9_.-]{1,120}$' then
        raise exception 'The file needs a plain name.' using errcode = '22023';
    end if;
    if (select count(*) from public.file_uploads u where u.member_id = me and u.created_at > now() - interval '1 day') >= 50 then
        raise exception 'You have uploaded 50 files today. Try again tomorrow.' using errcode = 'P0001';
    end if;
    perform app.check_file_room(org, space, size);

    key := org || '/' || space || '/' || gen_random_uuid() || '/' || file_name;
    insert into public.file_uploads (file_key, org_id, member_id, file_size) values (key, org, me, size);
    return key;
end
$$;

create or replace function public.save_file(file text, size bigint) returns void
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
    -- Only what the file grows by needs room.
    if size > link.file_size then
        perform app.check_file_room(link.org_id, link.space_id, size - link.file_size);
    end if;
    update public.links set file_size = size where id = link.id;
end
$$;
