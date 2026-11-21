-- Closes what a hand-made request could still do (the app's own screens never did any of it):
--
-- 1. Files. A link could name any file of its space as its own. So someone who knew a file's
--    key (from when they could still see it) could attach it to a suggestion of their own and
--    open it again after it was restricted, or delete that suggestion and have the daily cleanup
--    delete the file under the real link. Now an upload is recorded when it is asked for, a
--    file link must name an upload its author made, and a file belongs to one link only.
--    Uploads are also counted (50 a day per person). An upload that never became a link (the
--    form was closed before saving, or the upload was only asked for to fill the storage) has
--    no link to be deleted with, so the daily cleanup deletes it after a day.
-- 2. Limits on how much one person can store, so nobody can fill the database: links per space,
--    waiting suggestions per person, groups per space, people per organization, and the length
--    of names and colors that had none.


-- 1. Files ---------------------------------------------------------------------------------

create table public.file_uploads (
    file_key text primary key,
    org_id uuid not null,
    member_id uuid not null,
    file_size bigint not null,
    created_at timestamp with time zone default now() not null
);

create index file_uploads_member on public.file_uploads using btree (member_id, created_at);

-- Nobody reads or writes it through the Data API: only the functions below.
alter table public.file_uploads enable row level security;

-- Called by the server (netlify/functions, as the person uploading) before it signs an address
-- to upload to. Returns the key the file will be kept under.
create function public.start_upload(space uuid, file_name text, size bigint) returns text
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

    key := org || '/' || space || '/' || gen_random_uuid() || '/' || file_name;
    insert into public.file_uploads (file_key, org_id, member_id, file_size) values (key, org, me, size);
    return key;
end
$$;

revoke all on function public.start_upload(uuid, text, bigint) from public;
grant execute on function public.start_upload(uuid, text, bigint) to authenticated;

-- A file link names an upload its author made, and takes its size from what was uploaded.
create function app.check_link_file() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
declare
    upload public.file_uploads;
begin
    -- Not for the database's owner (maintenance), who has no account.
    if new.file_key is null or auth.uid() is null then
        return new;
    end if;
    select * into upload from public.file_uploads u where u.file_key = new.file_key;
    if upload.file_key is null or upload.member_id is distinct from new.created_by then
        raise exception 'Upload the file again, then save.' using errcode = 'P0001';
    end if;
    new.file_size := upload.file_size;
    return new;
end
$$;

revoke all on function app.check_link_file() from public;

-- Named to run after links_stamp_author (BEFORE triggers run in name order), which says who the author is.
create trigger links_uploaded_file before insert on public.links
    for each row execute function app.check_link_file();

-- One link per file. (Also what the server looks a file up by.)
create unique index links_file_key_unique on public.links using btree (file_key) where file_key is not null;

-- For the daily cleanup (netlify/functions/file-cleanup.mjs): forgets uploads older than a day,
-- and lists for deletion the ones that never became a link. Returns how many it listed.
create function public.sweep_file_uploads() returns integer
    language sql security definer
    set search_path to ''
    as $$
    with old as (
        delete from public.file_uploads where created_at < now() - interval '1 day' returning file_key
    ), trashed as (
        insert into public.file_trash (file_key)
        select o.file_key from old o where not exists (select 1 from public.links l where l.file_key = o.file_key)
        on conflict do nothing
        returning 1
    )
    select count(*)::integer from trashed
$$;

revoke all on function public.sweep_file_uploads() from public;
grant execute on function public.sweep_file_uploads() to teamshelf_files;


-- 2. Limits ---------------------------------------------------------------------------------

create function app.limit_links() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if auth.uid() is null then
        return new;
    end if;
    if (select count(*) from public.links l where l.space_id = new.space_id) >= 1000 then
        raise exception 'A space can hold up to 1000 links and files.' using errcode = 'P0001';
    end if;
    if new.status = 'pending' and (
        select count(*) from public.links l where l.org_id = new.org_id and l.created_by = new.created_by and l.status = 'pending'
    ) >= 20 then
        raise exception 'You have 20 suggestions waiting for review. Wait until some are reviewed.' using errcode = 'P0001';
    end if;
    return new;
end
$$;

revoke all on function app.limit_links() from public;

-- After links_stamp_author, like links_uploaded_file.
create trigger links_within_limits before insert on public.links
    for each row execute function app.limit_links();

create function app.limit_groups() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if auth.uid() is not null and (select count(*) from public.groups g where g.space_id = new.space_id) >= 200 then
        raise exception 'A space can have up to 200 groups.' using errcode = 'P0001';
    end if;
    return new;
end
$$;

revoke all on function app.limit_groups() from public;

create trigger groups_within_limits before insert on public.groups
    for each row execute function app.limit_groups();

-- People: how many an organization holds, how many may wait for approval (anyone running a
-- space can add to those), and the length of what is stored about each. A name comes from the
-- person's own account, so a long one is cut rather than refused.
create function app.limit_members() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    new.name := left(new.name, 100);
    if tg_op = 'INSERT' and auth.uid() is not null then
        if length(new.email) > 254 then
            raise exception 'That email address is too long.' using errcode = '22023';
        end if;
        if (select count(*) from public.members m where m.org_id = new.org_id) >= 200 then
            raise exception 'An organization can have up to 200 people.' using errcode = 'P0001';
        end if;
        if not new.approved and (select count(*) from public.members m where m.org_id = new.org_id and not m.approved) >= 50 then
            raise exception 'Too many invitations are waiting for approval. Ask an admin of the organization to review them first.' using errcode = 'P0001';
        end if;
    end if;
    return new;
end
$$;

revoke all on function app.limit_members() from public;

create trigger members_within_limits before insert or update of name on public.members
    for each row execute function app.limit_members();

alter table public.groups add constraint groups_color_check check (color ~ '^[a-z]{1,20}$');
alter table public.spaces add constraint spaces_color_check check (color ~ '^[a-z]{1,20}$');
