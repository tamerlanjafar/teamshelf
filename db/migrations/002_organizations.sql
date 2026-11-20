-- Organizations, categories, ordering and per-person board preferences.
--
-- Until now there was one team. Now anyone can create an organization, and everything
-- (members, groups, links) belongs to one. What existed before moves to "caspiantech".
--
-- Roles are per organization: its one super admin (the person who created it), admins, members.
-- A person joins an organization by invitation (any email), or without one when their email
-- is at one of the organization's allowed domains.

-- 1. Organizations ------------------------------------------------------------------------

create table public.orgs (
    id uuid primary key default gen_random_uuid(),
    -- The address: teamshelf.app/<slug>/
    slug text not null unique check (
        slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
        and length(slug) >= 2
        and slug not in ('login', 'new', 'join', 'assets', 'api', 'settings')
    ),
    name text not null check (length(trim(name)) between 1 and 60),
    -- People whose email is at one of these domains can join without an invitation.
    allowed_domains text[] not null default '{}' check (
        array_to_string(allowed_domains, ',') ~ '^([a-z0-9-]+(\.[a-z0-9-]+)+(,|$))*$'
    ),
    created_at timestamptz not null default now()
);

insert into public.orgs (slug, name, allowed_domains) values ('caspiantech', 'Caspiantech', '{caspiantech.az}');

-- 2. Remove the rules of the single-team version. They are written again below, per organization.

drop policy members_read on public.members;
drop policy members_invite on public.members;
drop policy members_change on public.members;
drop policy members_remove on public.members;
drop policy groups_read on public.groups;
drop policy groups_write on public.groups;
drop policy link_access_read on public.link_access;
drop policy link_access_write on public.link_access;
drop policy links_read on public.links;
drop policy links_suggest on public.links;
drop policy links_edit on public.links;
drop policy links_remove on public.links;

alter table public.members alter column invited_by drop default;
alter table public.links alter column created_by drop default;

drop function public.claim_membership();
drop function app.is_super_admin();
drop function app.is_admin();
drop function app.member_role();
drop function app.member_id();

revoke all on public.members, public.groups, public.links, public.link_access from authenticated;

-- 3. Members belong to an organization. The same person can be in several.

alter table public.members add column org_id uuid references public.orgs (id) on delete cascade;
update public.members set org_id = (select id from public.orgs where slug = 'caspiantech');
alter table public.members alter column org_id set not null;

alter table public.members drop constraint members_company_email;
alter table public.members add constraint members_email_shape check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.members drop constraint members_email_key;
alter table public.members drop constraint members_user_id_key;
alter table public.members add constraint members_org_email_key unique (org_id, email);
alter table public.members add constraint members_org_user_key unique (org_id, user_id);

drop index public.members_one_super_admin;
create unique index members_one_super_admin on public.members (org_id) where role = 'super_admin';
create index members_user on public.members (user_id);

-- 4. Helpers for the policies, now asking about one organization.

create function app.member_id(org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
    select id from public.members where org_id = org and user_id = auth.uid()
$$;

create function app.member_role(org uuid) returns text
language sql stable security definer set search_path = '' as $$
    select role from public.members where org_id = org and user_id = auth.uid()
$$;

create function app.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select app.member_id(org) is not null
$$;

create function app.is_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(app.member_role(org) in ('admin', 'super_admin'), false)
$$;

create function app.is_super_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(app.member_role(org) = 'super_admin', false)
$$;

-- The signed-in account, if its email is verified. Everything about joining goes by this email.
create function app.account() returns table (id uuid, email text, name text)
language sql stable security definer set search_path = '' as $$
    select u.id, lower(u.email), coalesce(u.name, '')
    from neon_auth."user" u
    where u.id = auth.uid() and u."emailVerified"
$$;

-- 5. Groups: per organization, with the team's order.

alter table public.groups add column org_id uuid references public.orgs (id) on delete cascade;
update public.groups set org_id = (select id from public.orgs where slug = 'caspiantech');
alter table public.groups alter column org_id set not null;
-- The place in the team's order. Groups without one come last, by name.
alter table public.groups add column position integer;

drop index public.groups_name_unique;
create unique index groups_name_unique on public.groups (org_id, lower(name));
alter table public.groups add constraint groups_id_org_key unique (id, org_id);

-- 6. Categories: what kind of thing a link is ("Frontend", "Infrastructure"). Each organization has its own list.

create table public.categories (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.orgs (id) on delete cascade,
    name text not null check (length(trim(name)) between 1 and 30),
    color text not null default 'graphite',
    position integer not null default 0,
    unique (id, org_id)
);

create unique index categories_name_unique on public.categories (org_id, lower(name));

create function app.add_default_categories(org uuid) returns void
language sql security definer set search_path = '' as $$
    insert into public.categories (org_id, name, color, position) values
        (org, 'Frontend', 'blue', 0),
        (org, 'Backend', 'green', 1),
        (org, 'Infrastructure', 'orange', 2),
        (org, 'Data', 'teal', 3),
        (org, 'QA', 'purple', 4),
        (org, 'Design', 'pink', 5),
        (org, 'Docs', 'graphite', 6)
$$;

select app.add_default_categories(id) from public.orgs;

-- 7. Links: per organization, one address each, with a category and the team's order.
--    A link no longer has an environment: it is part of the name ("Retail staging").

alter table public.links add column org_id uuid references public.orgs (id) on delete cascade;
update public.links set org_id = (select id from public.orgs where slug = 'caspiantech');
alter table public.links alter column org_id set not null;

update public.links set title = left(title || ' ' || environment, 80) where environment is not null;
alter table public.links drop column environment;

alter table public.links add column category_id uuid;
alter table public.links add column position integer;

-- A link's group and category are always in the link's own organization.
alter table public.links drop constraint links_group_id_fkey;
alter table public.links add constraint links_group_fkey
    foreign key (group_id, org_id) references public.groups (id, org_id) on delete cascade;
alter table public.links add constraint links_category_fkey
    foreign key (category_id, org_id) references public.categories (id, org_id) on delete set null (category_id);

create index links_org on public.links (org_id);

-- Who suggested a link and who invited a member is filled in here, not sent by the browser.
create function app.stamp_link_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is not null then
        new.created_by := app.member_id(new.org_id);
    end if;
    return new;
end
$$;

create trigger links_stamp_author before insert on public.links
    for each row execute function app.stamp_link_author();

create function app.stamp_inviter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is not null then
        new.invited_by := app.member_id(new.org_id);
    end if;
    return new;
end
$$;

create trigger members_stamp_inviter before insert on public.members
    for each row execute function app.stamp_inviter();

-- 8. A person's own arrangement of the board. Nobody else sees or is affected by it.

create table public.member_prefs (
    member_id uuid primary key references public.members (id) on delete cascade,
    -- The person's own order of the groups. Empty: the team's order.
    group_order uuid[] not null default '{}',
    -- The person's own order of the links, per group they rearranged: { "<group id>": ["<link id>", …] }.
    -- A group that is not listed follows the team's order.
    link_order jsonb not null default '{}',
    hidden_groups uuid[] not null default '{}',
    hidden_links uuid[] not null default '{}',
    updated_at timestamptz not null default now()
);

-- 9. Functions the app calls ---------------------------------------------------------------

-- Ties this account to the invitations sent to its email. In one organization, or in all.
create function app.claim_invitations(only_org uuid default null) returns void
language sql security definer set search_path = '' as $$
    update public.members m
    set user_id = a.id,
        joined_at = now(),
        name = case when m.name = '' then a.name else m.name end
    from app.account() a
    where m.email = a.email
        and m.user_id is null
        and (only_org is null or m.org_id = only_org)
$$;

-- The organizations this person is in, and the ones they can join because of their email's domain.
create function public.my_orgs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    account record;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('orgs', '[]'::jsonb, 'joinable', '[]'::jsonb);
    end if;

    perform app.claim_invitations();

    return jsonb_build_object(
        'orgs', (
            select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'role', m.role) order by o.name), '[]'::jsonb)
            from public.members m join public.orgs o on o.id = m.org_id
            where m.user_id = account.id
        ),
        'joinable', (
            select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name) order by o.name), '[]'::jsonb)
            from public.orgs o
            where split_part(account.email, '@', 2) = any (o.allowed_domains)
                and not exists (select 1 from public.members m where m.org_id = o.id and m.user_id = account.id)
        )
    );
end
$$;

-- One organization, by its address. Returns the organization and this person's membership,
-- or says that they may join. Null when the organization doesn't exist or isn't theirs to see.
create function public.open_org(org_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
    member public.members;
begin
    select * into account from app.account();
    select * into org from public.orgs where slug = lower(org_slug);
    if account.id is null or org.id is null then
        return null;
    end if;

    perform app.claim_invitations(org.id);
    select * into member from public.members where org_id = org.id and user_id = account.id;

    if member.id is not null then
        return jsonb_build_object('org', to_jsonb(org), 'member', to_jsonb(member), 'can_join', false);
    end if;
    if split_part(account.email, '@', 2) = any (org.allowed_domains) then
        return jsonb_build_object('org', jsonb_build_object('slug', org.slug, 'name', org.name), 'member', null, 'can_join', true);
    end if;
    return null;
end
$$;

-- Joins an organization without an invitation. Only for emails at one of its allowed domains.
create function public.join_org(org_slug text) returns public.members
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
    member public.members;
begin
    select * into account from app.account();
    select * into org from public.orgs where slug = lower(org_slug);
    if account.id is null or org.id is null or not (split_part(account.email, '@', 2) = any (org.allowed_domains)) then
        raise exception 'You can''t join this organization without an invitation.' using errcode = '42501';
    end if;

    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'member', account.id, now())
    on conflict (org_id, email) do update set user_id = excluded.user_id, joined_at = now()
    returning * into member;
    return member;
end
$$;

-- Creates an organization. The person who creates it is its super admin.
create function public.create_org(org_name text, org_slug text) returns public.orgs
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
begin
    select * into account from app.account();
    if account.id is null then
        raise exception 'Sign in to create an organization.' using errcode = '42501';
    end if;

    insert into public.orgs (name, slug) values (trim(org_name), lower(trim(org_slug))) returning * into org;
    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'super_admin', account.id, now());
    perform app.add_default_categories(org.id);
    return org;
end
$$;

-- The team's order of the groups: the given groups, in this order. Admins and the super admin.
create function public.set_group_order(org uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not app.is_admin(org) then
        raise exception 'Only admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.groups g
    set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where g.id = listed.id and g.org_id = org;
end
$$;

-- The team's order of the links of one group. Admins and the super admin.
create function public.set_link_order(group_id uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
    org uuid;
begin
    select g.org_id into org from public.groups g where g.id = set_link_order.group_id;
    if org is null or not app.is_admin(org) then
        raise exception 'Only admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.links l
    set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where l.id = listed.id and l.group_id = set_link_order.group_id;
end
$$;

revoke all on all functions in schema public from public;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
grant execute on function public.my_orgs(), public.open_org(text), public.join_org(text), public.create_org(text, text),
    public.set_group_order(uuid, uuid[]), public.set_link_order(uuid, uuid[]) to authenticated;

-- 10. Who may read and change what ----------------------------------------------------------

-- Organizations: members read theirs. The super admin changes its name and allowed domains.
-- Creating one goes through create_org().
alter table public.orgs enable row level security;

grant select on public.orgs to authenticated;
grant update (name, allowed_domains) on public.orgs to authenticated;

create policy orgs_read on public.orgs for select to authenticated
    using (app.is_member(id));

create policy orgs_change on public.orgs for update to authenticated
    using (app.is_super_admin(id))
    with check (app.is_super_admin(id));

-- Members: everyone in an organization sees its people. Admins invite (any email), change roles
-- and remove people, but nobody can touch the super admin's row or create a second one.
grant select, delete on public.members to authenticated;
grant insert (org_id, email, name, role) on public.members to authenticated;
grant update (name, role) on public.members to authenticated;

create policy members_read on public.members for select to authenticated
    using (app.is_member(org_id));

create policy members_invite on public.members for insert to authenticated
    with check (app.is_admin(org_id) and role in ('admin', 'member'));

create policy members_change on public.members for update to authenticated
    using (app.is_admin(org_id) and role <> 'super_admin')
    with check (role in ('admin', 'member'));

create policy members_remove on public.members for delete to authenticated
    using (app.is_admin(org_id) and role <> 'super_admin');

-- Groups and categories: members read, the super admin edits.
-- (The team's order of groups is changed by admins through set_group_order().)
grant select, delete on public.groups to authenticated;
grant insert (org_id, name, color) on public.groups to authenticated;
grant update (name, color) on public.groups to authenticated;

create policy groups_read on public.groups for select to authenticated
    using (app.is_member(org_id));

create policy groups_write on public.groups for all to authenticated
    using (app.is_super_admin(org_id))
    with check (app.is_super_admin(org_id));

alter table public.categories enable row level security;

grant select, delete on public.categories to authenticated;
grant insert (org_id, name, color, position) on public.categories to authenticated;
grant update (name, color, position) on public.categories to authenticated;

create policy categories_read on public.categories for select to authenticated
    using (app.is_member(org_id));

create policy categories_write on public.categories for all to authenticated
    using (app.is_super_admin(org_id))
    with check (app.is_super_admin(org_id));

-- Links: a member sees approved links they are allowed to see, and their own suggestions.
-- Anyone in the organization may suggest a link, but only as pending and visible to everyone.
-- The super admin reviews and edits. A member may remove their own suggestions that are not on the board.
grant select, delete on public.links to authenticated;
grant insert (org_id, group_id, proposed_group, title, url, note, category_id, status, visibility, reviewed_at)
    on public.links to authenticated;
grant update (group_id, proposed_group, title, url, note, category_id, status, visibility, reviewed_at, review_note)
    on public.links to authenticated;

create policy links_read on public.links for select to authenticated
    using (
        app.is_super_admin(org_id)
        or created_by = app.member_id(org_id)
        or (
            status = 'approved'
            and (
                (visibility = 'everyone' and app.is_member(org_id))
                or (visibility = 'admins' and app.is_admin(org_id))
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
        and (
            app.is_super_admin(org_id)
            or (status = 'pending' and visibility = 'everyone' and reviewed_at is null)
        )
    );

create policy links_edit on public.links for update to authenticated
    using (app.is_super_admin(org_id))
    with check (app.is_super_admin(org_id));

create policy links_remove on public.links for delete to authenticated
    using (
        app.is_super_admin(org_id)
        or (created_by = app.member_id(org_id) and status <> 'approved')
    );

-- Link access: the link's super admin edits (and only for people of the same organization),
-- a member sees their own entries.
grant select, insert, delete on public.link_access to authenticated;

create policy link_access_read on public.link_access for select to authenticated
    using (
        exists (
            select 1 from public.links l
            where l.id = link_id and (member_id = app.member_id(l.org_id) or app.is_super_admin(l.org_id))
        )
    );

create policy link_access_grant on public.link_access for insert to authenticated
    with check (
        exists (
            select 1 from public.links l join public.members m on m.org_id = l.org_id
            where l.id = link_id and m.id = member_id and app.is_super_admin(l.org_id)
        )
    );

create policy link_access_revoke on public.link_access for delete to authenticated
    using (
        exists (select 1 from public.links l where l.id = link_id and app.is_super_admin(l.org_id))
    );

-- Preferences: only your own.
alter table public.member_prefs enable row level security;

grant select, insert, update on public.member_prefs to authenticated;

create policy member_prefs_own on public.member_prefs for all to authenticated
    using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()))
    with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));
