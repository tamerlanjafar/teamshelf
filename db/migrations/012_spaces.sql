-- Spaces, instead of categories.
--
-- An organization is split into spaces, one per team ("Development", "Design", "Data"…). Every
-- group, and so every link, belongs to one space. Each space has its own admins, who do
-- everything inside it: add and review links, create, rename, reorder and delete groups, choose
-- who is in the space, whether the rest of the organization sees it, its logo and its environments.
--
--   visibility 'org':     everyone in the organization sees the space and can suggest links.
--   visibility 'private': only the space's members see it. Joining the organization (by invitation
--                         or through an allowed domain) doesn't show it to anyone.
--
-- The organization's super admin can open and manage every space. The organization's admins
-- can create spaces (and are admins of the ones they create).
--
-- Categories and category managers are gone: a space's admins do what managers did.
-- Everything that existed moves to the space "Development".
--
-- A link can also be a file, kept in Cloudflare R2 (see netlify/functions/files.mjs).
-- And link names are checked here too, so the stricter rules can't be got around.

-- 0. "/file" is now a page of the app (a file's own address), so no organization can have it.

alter table public.orgs drop constraint orgs_slug_check;
alter table public.orgs add constraint orgs_slug_check check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
    and length(slug) >= 2
    and slug not in ('login', 'new', 'join', 'assets', 'api', 'settings', 'organizations', 'file')
);

-- 1. Spaces -------------------------------------------------------------------------------------

create table public.spaces (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.orgs (id) on delete cascade,
    -- In the address: /<org>/?space=<slug>
    slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
    name text not null check (name = trim(name) and length(name) between 1 and 40),
    -- One of the app's own logos ("code", "pen-tool"…), or a small image carried in the address.
    logo text not null default 'grid' check (
        logo ~ '^[a-z0-9-]{1,30}$'
        or (logo ~* '^data:image/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$' and length(logo) <= 140000)
    ),
    color text not null default 'indigo',
    visibility text not null default 'org' check (visibility in ('org', 'private')),
    -- What may follow " - " in a link's name, in the order the board shows them.
    environments text[] not null default '{Staging,Prod}' check (
        cardinality(environments) <= 16
        and array_to_string(environments, ',') ~ '^([A-Z][A-Za-z0-9]{0,15}(,|$))*$'
    ),
    position integer,
    created_at timestamptz not null default now(),
    unique (org_id, slug),
    unique (id, org_id)
);

create unique index spaces_name_unique on public.spaces (org_id, lower(name));

-- Who is in a space. Admins manage it, members see it (which only matters for a private space:
-- everyone sees a space that is open to the organization).
create table public.space_members (
    space_id uuid not null references public.spaces (id) on delete cascade,
    member_id uuid not null references public.members (id) on delete cascade,
    role text not null default 'member' check (role in ('admin', 'member')),
    added_at timestamptz not null default now(),
    primary key (space_id, member_id)
);

create index space_members_member on public.space_members (member_id);

-- 2. Helpers for the policies ------------------------------------------------------------------

create function app.space_org(space uuid) returns uuid
language sql stable security definer set search_path = '' as $$
    select org_id from public.spaces where id = space
$$;

-- 'admin', 'member', or null: the signed-in person's place in the space.
create function app.space_role(space uuid) returns text
language sql stable security definer set search_path = '' as $$
    select sm.role
    from public.space_members sm join public.members m on m.id = sm.member_id
    where sm.space_id = space and m.user_id = auth.uid()
$$;

create function app.is_space_admin(space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(app.is_super_admin(app.space_org(space)) or app.space_role(space) = 'admin', false)
$$;

create function app.can_see_space(space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce((
        select app.is_super_admin(s.org_id)
            or (s.visibility = 'org' and app.is_member(s.org_id))
            or (app.space_role(s.id) is not null and app.is_member(s.org_id))
        from public.spaces s where s.id = space
    ), false)
$$;

revoke all on function app.space_org(uuid), app.space_role(uuid), app.is_space_admin(uuid), app.can_see_space(uuid) from public;
grant execute on function app.space_org(uuid), app.space_role(uuid), app.is_space_admin(uuid), app.can_see_space(uuid) to authenticated;

-- 3. The spaces every organization starts with --------------------------------------------------

create function app.add_default_spaces(org uuid, creator uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.spaces (org_id, slug, name, logo, color, position) values
        (org, 'development', 'Development', 'code', 'indigo', 1),
        (org, 'design', 'Design', 'pen-tool', 'pink', 2),
        (org, 'product', 'Product', 'compass', 'orange', 3),
        (org, 'data', 'Data', 'chart', 'teal', 4),
        (org, 'qa', 'QA', 'check-badge', 'green', 5),
        (org, 'devops', 'DevOps', 'server', 'blue', 6),
        (org, 'people', 'People', 'users', 'purple', 7);
    if creator is not null then
        insert into public.space_members (space_id, member_id, role)
        select s.id, creator, 'admin' from public.spaces s where s.org_id = org;
    end if;
end
$$;

revoke all on function app.add_default_spaces(uuid, uuid) from public, authenticated;

select app.add_default_spaces(o.id, (select m.id from public.members m where m.org_id = o.id and m.role = 'super_admin'))
from public.orgs o;

-- Whoever managed a category reviewed links. They now run the space those links moved to.
insert into public.space_members (space_id, member_id, role)
select distinct s.id, cm.member_id, 'admin'
from public.category_managers cm
    join public.members m on m.id = cm.member_id
    join public.spaces s on s.org_id = m.org_id and s.slug = 'development'
on conflict (space_id, member_id) do update set role = 'admin';

-- 4. Groups and links belong to a space ---------------------------------------------------------

alter table public.groups add column space_id uuid;
update public.groups g set space_id = (select s.id from public.spaces s where s.org_id = g.org_id and s.slug = 'development');
alter table public.groups alter column space_id set not null;
alter table public.groups add constraint groups_space_fkey foreign key (space_id, org_id) references public.spaces (id, org_id) on delete cascade;
alter table public.groups add constraint groups_id_space_key unique (id, space_id);
drop index public.groups_name_unique;
create unique index groups_name_unique on public.groups (space_id, lower(name));

alter table public.links add column space_id uuid;
update public.links l set space_id = (select s.id from public.spaces s where s.org_id = l.org_id and s.slug = 'development');
alter table public.links alter column space_id set not null;
alter table public.links add constraint links_space_fkey foreign key (space_id, org_id) references public.spaces (id, org_id) on delete cascade;
-- A link's group is in the link's own space.
alter table public.links add constraint links_group_space_fkey foreign key (group_id, space_id) references public.groups (id, space_id) on delete cascade;
create index links_space on public.links (space_id);

create function app.link_space(link uuid) returns uuid
language sql stable security definer set search_path = '' as $$
    select space_id from public.links where id = link
$$;

revoke all on function app.link_space(uuid) from public;
grant execute on function app.link_space(uuid) to authenticated;

-- 5. Categories go -----------------------------------------------------------------------------

drop policy links_read on public.links;
drop policy links_suggest on public.links;
drop policy links_edit on public.links;
drop policy links_remove on public.links;
drop policy groups_read on public.groups;
drop policy groups_write on public.groups;
drop policy groups_start on public.groups;
drop policy link_access_read on public.link_access;
drop policy link_access_grant on public.link_access;
drop policy link_access_revoke on public.link_access;

alter table public.links drop column category_id;
drop table public.category_managers;
drop table public.categories;
drop function app.manages(uuid);
drop function app.manages_any(uuid);
drop function app.category_org(uuid);
drop function app.add_default_categories(uuid);

-- 6. Files -------------------------------------------------------------------------------------
--
-- A file is a link whose address is the app's own download route. The file itself is in R2,
-- under "<org id>/<space id>/…", which the upload function chose.

alter table public.links add column kind text not null default 'link' check (kind in ('link', 'file'));
alter table public.links add column file_key text check (length(file_key) <= 400);
alter table public.links add column file_name text check (length(file_name) between 1 and 200);
alter table public.links add column file_size bigint check (file_size between 0 and 26214400);
alter table public.links add column file_type text check (length(file_type) <= 120);
alter table public.links add constraint links_file_shape check (
    (kind = 'link' and file_key is null)
    or (kind = 'file' and file_key is not null and file_name is not null and file_size is not null
        and file_key like org_id::text || '/' || space_id::text || '/%')
);

-- Files whose link is gone, for the cleanup job to delete from R2. Nobody reads it through the Data API.
create table public.file_trash (
    file_key text primary key,
    trashed_at timestamptz not null default now()
);
alter table public.file_trash enable row level security;

create function app.trash_file() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if old.file_key is not null and (tg_op = 'DELETE' or new.file_key is distinct from old.file_key) then
        insert into public.file_trash (file_key) values (old.file_key) on conflict do nothing;
    end if;
    return null;
end
$$;

create trigger links_trash_file after delete or update of file_key on public.links
    for each row execute function app.trash_file();

revoke all on function app.trash_file() from public, authenticated;

-- The daily cleanup (netlify/functions/file-cleanup.mjs) connects as "linkboard_files", which
-- can only read and clear this list. The role is made in Neon's console (it has a password,
-- which doesn't belong in this file); where it doesn't exist, this step is left out.
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'linkboard_files') then
        grant usage on schema public to linkboard_files;
        grant select, delete on public.file_trash to linkboard_files;
        create policy file_trash_cleanup on public.file_trash for all to linkboard_files using (true);
    end if;
end
$$;

-- 7. Link names --------------------------------------------------------------------------------
--
-- The same rules the form checks (src/features/links/name-rules.ts), except the two that need
-- the other links of the group to compare with (spelling a thing like its siblings do, and an
-- environment word in the middle of a name). Checked when a name is written or changed, so
-- names that were saved before stay as they are until someone edits them.

alter table public.links drop constraint links_title_check;
alter table public.links add constraint links_title_check check (length(title) between 1 and 80);

create function app.link_name_error(title text, group_name text, environments text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
    name text := title;
    rest text;
    env text;
    word text;
    first_word text;
begin
    if name is null or name = '' then return 'Give the link a name.'; end if;
    if name <> btrim(name) then return 'Remove the spaces at the start and end of the name.'; end if;
    if length(name) < 2 then return 'A name needs at least 2 characters.'; end if;
    if length(name) > 60 then return format('Keep the name to 60 characters. This one has %s.', length(name)); end if;
    if name ~* '://|^www\.' or name ~ '^[[:alnum:]_-]+(\.[[:alnum:]_-]+)+(/\S*)?$' then
        return 'This is an address, not a name. Write what the link opens.';
    end if;

    if group_name is not null and btrim(group_name) <> '' and lower(name) like lower(btrim(group_name)) || '%' then
        rest := substr(name, length(btrim(group_name)) + 1);
        if rest ~ '^(\s+[-–—|:,]?|[–—|:,])\s*\S' then
            return format('Drop “%s” from the front. The card already shows the group.', btrim(group_name));
        end if;
    end if;

    if name ~ '[–—|:_]' then return 'Separate the environment with “ - ” (space, hyphen, space), and use spaces between words.'; end if;
    if name !~ '^[[:alpha:][:digit:] .&''()/+#,-]+$' then return 'Names use letters, digits, spaces and . , & '' ( ) / + # -'; end if;
    if name ~ '\s\s' then return 'Use one space between words.'; end if;
    if name ~ '\s-\S|\S-\s' then return 'Put a space on both sides of the hyphen: “ - ”.'; end if;
    if name ~ '[.,/&+-]$' then return 'Remove the punctuation at the end.'; end if;
    if name !~ '^[[:alpha:][:digit:](]' then return 'Start the name with a letter or a digit.'; end if;
    if length(name) - length(replace(name, '(', '')) <> length(name) - length(replace(name, ')', '')) then
        return 'Close the bracket, or remove it.';
    end if;
    if lower(name) in ('link', 'links', 'website', 'site', 'url', 'page', 'here', 'home', 'new link', 'untitled', 'click here', 'open', 'app') then
        return 'The name doesn''t say what the link opens. Name the tool or the page.';
    end if;

    if array_length(string_to_array(name, ' - '), 1) > 2 then return 'Use “ - ” once, only before the environment.'; end if;
    if position(' - ' in name) > 0 then
        env := split_part(name, ' - ', 2);
        if not (env = any (coalesce(environments, '{}'))) then
            return format('“%s” isn''t an environment of this space. After “ - ” write one of: %s.', env, array_to_string(environments, ', '));
        end if;
    end if;

    first_word := split_part(regexp_replace(name, '^\(', ''), ' ', 1);
    if first_word ~ '^[[:lower:]]' and first_word !~ '[[:upper:]]' then return 'Start with a capital letter.'; end if;
    foreach word in array regexp_split_to_array(name, '[\s()/-]+') loop
        if word ~ '^[[:upper:]]{6,}$' then
            return format('Write “%s” with small letters. Capitals are for abbreviations of up to 5 letters.', word);
        end if;
    end loop;
    return null;
end
$$;

create function app.check_link_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    problem text;
begin
    if tg_op = 'UPDATE' and new.title is not distinct from old.title then
        return new;
    end if;
    problem := app.link_name_error(
        new.title,
        coalesce((select g.name from public.groups g where g.id = new.group_id), new.proposed_group),
        (select s.environments from public.spaces s where s.id = new.space_id)
    );
    if problem is not null then
        raise exception '%', problem using errcode = 'P0001', hint = 'link-name';
    end if;
    return new;
end
$$;

create trigger links_check_name before insert or update of title on public.links
    for each row execute function app.check_link_name();

revoke all on function app.check_link_name() from public, authenticated;
grant execute on function app.link_name_error(text, text, text[]) to authenticated;

-- A name appears once in a group.
create unique index links_group_title on public.links (group_id, lower(title)) where status = 'approved';

-- 8. Who may read and change what --------------------------------------------------------------

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

grant select, delete on public.spaces to authenticated;
grant update (name, logo, color, visibility, environments) on public.spaces to authenticated;

create policy spaces_read on public.spaces for select to authenticated
    using (app.can_see_space(id));

create policy spaces_change on public.spaces for update to authenticated
    using (app.is_space_admin(id))
    with check (app.is_space_admin(id));

create policy spaces_delete on public.spaces for delete to authenticated
    using (app.is_space_admin(id));

grant select, delete on public.space_members to authenticated;
grant insert (space_id, member_id, role) on public.space_members to authenticated;
grant update (role) on public.space_members to authenticated;

create policy space_members_read on public.space_members for select to authenticated
    using (app.can_see_space(space_id));

create policy space_members_add on public.space_members for insert to authenticated
    with check (
        app.is_space_admin(space_id)
        and exists (select 1 from public.members m where m.id = member_id and m.org_id = app.space_org(space_id))
    );

create policy space_members_change on public.space_members for update to authenticated
    using (app.is_space_admin(space_id))
    with check (app.is_space_admin(space_id));

create policy space_members_remove on public.space_members for delete to authenticated
    using (app.is_space_admin(space_id));

-- Groups: everyone who sees the space reads them, its admins change them.
revoke insert, update on public.groups from authenticated;
grant insert (org_id, space_id, name, color) on public.groups to authenticated;
grant update (name, color) on public.groups to authenticated;

create policy groups_read on public.groups for select to authenticated
    using (app.can_see_space(space_id));

create policy groups_write on public.groups for all to authenticated
    using (app.is_space_admin(space_id))
    with check (app.is_space_admin(space_id));

-- Links: the rules of before, with "the super admin" now "an admin of the link's space", and
-- "admins only" now meaning the space's admins.
revoke insert, update on public.links from authenticated;
grant insert (org_id, space_id, group_id, proposed_group, title, url, icon_url, status, visibility, reviewed_at, kind, file_key, file_name, file_size, file_type)
    on public.links to authenticated;
grant update (group_id, proposed_group, title, url, icon_url, status, visibility, reviewed_at, review_note)
    on public.links to authenticated;

create policy links_read on public.links for select to authenticated
    using (
        app.is_space_admin(space_id)
        or created_by = app.member_id(org_id)
        or (
            status = 'approved'
            and app.can_see_space(space_id)
            and (
                visibility = 'everyone'
                or (
                    visibility = 'members'
                    and exists (
                        select 1 from public.link_access a
                        where a.link_id = links.id and a.member_id = app.member_id(links.org_id)
                    )
                )
            )
        )
    );

create policy links_suggest on public.links for insert to authenticated
    with check (
        created_by = app.member_id(org_id)
        and app.can_see_space(space_id)
        and (
            app.is_space_admin(space_id)
            or (status = 'pending' and visibility = 'everyone' and reviewed_at is null)
        )
    );

create policy links_edit on public.links for update to authenticated
    using (app.is_space_admin(space_id))
    with check (app.is_space_admin(space_id));

create policy links_remove on public.links for delete to authenticated
    using (
        app.is_space_admin(space_id)
        or (created_by = app.member_id(org_id) and status <> 'approved')
    );

create policy link_access_read on public.link_access for select to authenticated
    using (
        member_id = app.member_id(app.link_org(link_id))
        or app.is_space_admin(app.link_space(link_id))
    );

create policy link_access_grant on public.link_access for insert to authenticated
    with check (
        app.is_space_admin(app.link_space(link_id))
        and exists (select 1 from public.members m where m.id = member_id and m.org_id = app.link_org(link_id))
    );

create policy link_access_revoke on public.link_access for delete to authenticated
    using (app.is_space_admin(app.link_space(link_id)));

-- 9. Functions the app calls -------------------------------------------------------------------

-- Creates a space. Admins of the organization; the creator is its first admin.
create function public.create_space(org uuid, space_name text, space_slug text, space_logo text default 'grid', space_color text default 'indigo')
returns public.spaces
language plpgsql security definer set search_path = '' as $$
declare
    space public.spaces;
begin
    if not app.is_admin(org) then
        raise exception 'Only admins of the organization can create spaces.' using errcode = '42501';
    end if;
    if (select count(*) from public.spaces where org_id = org) >= 50 then
        raise exception 'An organization can have up to 50 spaces.' using errcode = '42501';
    end if;
    insert into public.spaces (org_id, slug, name, logo, color, position)
    values (org, lower(trim(space_slug)), trim(space_name), space_logo, space_color,
            coalesce((select max(position) from public.spaces where org_id = org), 0) + 1)
    returning * into space;
    insert into public.space_members (space_id, member_id, role) values (space.id, app.member_id(org), 'admin');
    return space;
end
$$;

-- The organization's order of its spaces. The super admin.
create function public.set_space_order(org uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not app.is_super_admin(org) then
        raise exception 'Only the super admin can change the order of spaces.' using errcode = '42501';
    end if;
    update public.spaces s set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where s.id = listed.id and s.org_id = org;
end
$$;

drop function public.set_group_order(uuid, uuid[]);
drop function public.set_link_order(uuid, uuid[]);

-- The order of a space's groups, for everyone in it. The space's admins.
create function public.set_group_order(space uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not app.is_space_admin(space) then
        raise exception 'Only the space''s admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.groups g set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where g.id = listed.id and g.space_id = space;
end
$$;

-- The order of one group's links, for everyone. The space's admins.
create function public.set_link_order(group_id uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
    space uuid;
begin
    select g.space_id into space from public.groups g where g.id = set_link_order.group_id;
    if space is null or not app.is_space_admin(space) then
        raise exception 'Only the space''s admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.links l set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where l.id = listed.id and l.group_id = set_link_order.group_id;
end
$$;

-- Whether this person may add a file to the space (the upload function asks, as the person).
create function public.can_add_to_space(space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select app.can_see_space(space)
$$;

-- A new organization starts with the default spaces instead of categories.
create or replace function public.create_org(org_name text, org_slug text) returns public.orgs
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
    creator uuid;
begin
    select * into account from app.account();
    if account.id is null then
        raise exception 'Sign in to create an organization.' using errcode = '42501';
    end if;
    if not app.can_create_org(account.email) then
        raise exception 'This account can''t create organizations.' using errcode = '42501';
    end if;
    if (select count(*) from public.members where user_id = account.id and role = 'super_admin') >= 10 then
        raise exception 'You have created the most organizations one account can have.' using errcode = '42501';
    end if;

    insert into public.orgs (name, slug) values (trim(org_name), lower(trim(org_slug))) returning * into org;
    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'super_admin', account.id, now())
    returning id into creator;
    perform app.add_default_spaces(org.id, creator);
    return org;
end
$$;

revoke all on function public.create_space(uuid, text, text, text, text), public.set_space_order(uuid, uuid[]),
    public.set_group_order(uuid, uuid[]), public.set_link_order(uuid, uuid[]), public.can_add_to_space(uuid) from public;
grant execute on function public.create_space(uuid, text, text, text, text), public.set_space_order(uuid, uuid[]),
    public.set_group_order(uuid, uuid[]), public.set_link_order(uuid, uuid[]), public.can_add_to_space(uuid) to authenticated;

-- 10. A request that arrives without the person's identity -------------------------------------
--
-- When the database has been asleep, the first requests after it wakes can arrive before the
-- signed-in person's identity is in place (auth.uid() is null). The policies then answered
-- "nothing here", and the board showed no links until a reload. Asking who someone is now
-- fails instead, with code 28000, and the app asks again a moment later.

create or replace function app.member_id(org uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
    if auth.uid() is null then
        raise exception 'Your account isn''t ready yet. Try again in a moment.' using errcode = '28000';
    end if;
    return (select id from public.members where org_id = org and user_id = auth.uid());
end
$$;

create or replace function app.member_role(org uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
    if auth.uid() is null then
        raise exception 'Your account isn''t ready yet. Try again in a moment.' using errcode = '28000';
    end if;
    return (select role from public.members where org_id = org and user_id = auth.uid());
end
$$;
