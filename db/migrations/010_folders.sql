-- Folders inside a group, and folders inside folders: a way to arrange a long group (all of a
-- team's documentation, say) without splitting it into more groups.
--
-- A folder belongs to one group and, unless it is at the top of the group, to a parent folder
-- of the same group, at most 6 deep. A link is either at the top of its group (folder_id null)
-- or in one of its group's folders. The space's admins create, rename, move and delete folders,
-- as they do groups; anyone who sees the space sees its folders. Someone suggesting a link may
-- name one of the group's folders for it.
--
-- Deleting a folder keeps what is in it: its links and folders move up to where the folder was.
-- Deleting a group deletes its folders with it, as it deletes its links.

create table public.folders (
    id uuid default gen_random_uuid() primary key,
    org_id uuid not null,
    space_id uuid not null,
    group_id uuid not null,
    parent_id uuid references public.folders(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default now() not null,
    constraint folders_name_check check (length(trim(name)) between 1 and 60),
    constraint folders_group_fkey foreign key (group_id, org_id) references public.groups(id, org_id) on delete cascade,
    constraint folders_group_space_fkey foreign key (group_id, space_id) references public.groups(id, space_id) on delete cascade,
    constraint folders_not_own_parent check (parent_id is distinct from id)
);

-- Two folders side by side don't share a name (ignoring case).
create unique index folders_name_unique on public.folders (group_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index folders_group on public.folders (group_id);
create index folders_parent on public.folders (parent_id) where parent_id is not null;

alter table public.folders enable row level security;

create policy folders_read on public.folders for select to authenticated using (app.can_see_space(space_id));
create policy folders_write on public.folders to authenticated using (app.is_space_admin(space_id)) with check (app.is_space_admin(space_id));

grant select, delete on table public.folders to authenticated;
grant insert (org_id, space_id, group_id) on table public.folders to authenticated;
grant insert (parent_id, name), update (parent_id, name) on table public.folders to authenticated;

-- A folder's parent is in the same group, never inside the folder itself, and no folder is
-- more than 6 deep. Up to 500 folders per space.
create function app.check_folder() returns trigger
    language plpgsql
    set search_path to ''
    as $$
declare
    parent public.folders;
    depth integer := 1;
    deepest integer;
    cursor_id uuid;
begin
    if tg_op = 'INSERT' and auth.uid() is not null and (select count(*) from public.folders f where f.space_id = new.space_id) >= 500 then
        raise exception 'A space can have up to 500 folders.' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and (new.group_id <> old.group_id or new.space_id <> old.space_id or new.org_id <> old.org_id) then
        raise exception 'A folder stays in its group.' using errcode = 'P0001';
    end if;
    if new.parent_id is null then
        return new;
    end if;
    select * into parent from public.folders f where f.id = new.parent_id;
    if parent.id is null or parent.group_id <> new.group_id then
        raise exception 'A folder can only go in a folder of the same group.' using errcode = 'P0001';
    end if;
    -- Up from the new parent: how deep it is, and that the folder itself isn't on the way.
    cursor_id := new.parent_id;
    while cursor_id is not null loop
        if cursor_id = new.id then
            raise exception 'A folder can''t go inside itself.' using errcode = 'P0001';
        end if;
        depth := depth + 1;
        select f.parent_id into cursor_id from public.folders f where f.id = cursor_id;
    end loop;
    -- The deepest folder under this one moves with it.
    with recursive below as (
        select f.id, 1 as level from public.folders f where f.parent_id = new.id
        union all
        select f.id, b.level + 1 from public.folders f join below b on f.parent_id = b.id
    )
    select coalesce(max(level), 0) into deepest from below;
    if depth + deepest > 6 then
        raise exception 'Folders go at most 6 deep.' using errcode = 'P0001';
    end if;
    return new;
end
$$;

revoke all on function app.check_folder() from public;

create trigger folders_check before insert or update on public.folders
    for each row execute function app.check_folder();

-- Deleting a folder moves what is in it up a level. Not when its group is being deleted:
-- everything goes then.
create function app.keep_folder_contents() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if not exists (select 1 from public.groups g where g.id = old.group_id) then
        return old;
    end if;
    update public.folders f set parent_id = old.parent_id where f.parent_id = old.id;
    update public.links l set folder_id = old.parent_id where l.folder_id = old.id;
    return old;
end
$$;

revoke all on function app.keep_folder_contents() from public;

create trigger folders_keep_contents before delete on public.folders
    for each row execute function app.keep_folder_contents();

-- A link's folder.
alter table public.links add column folder_id uuid references public.folders(id) on delete set null;
create index links_folder on public.links (folder_id) where folder_id is not null;
grant insert (folder_id), update (folder_id) on table public.links to authenticated;

-- A link's folder is one of its group's (a suggestion for a new group has none).
create function app.check_link_folder() returns trigger
    language plpgsql
    set search_path to ''
    as $$
begin
    if new.folder_id is null then
        return new;
    end if;
    if new.group_id is null or not exists (select 1 from public.folders f where f.id = new.folder_id and f.group_id = new.group_id) then
        raise exception 'A link can only go in a folder of its own group.' using errcode = 'P0001';
    end if;
    return new;
end
$$;

revoke all on function app.check_link_folder() from public;

create trigger links_folder_check before insert or update of folder_id, group_id on public.links
    for each row execute function app.check_link_folder();

-- Names are unique per folder now, not per group: each folder can have its own "Overview".
drop index public.links_group_title;
create unique index links_group_title on public.links (group_id, coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(title)) where (status = 'approved');
