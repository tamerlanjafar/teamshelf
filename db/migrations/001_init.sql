-- Linkboard schema.
--
-- The browser talks to this database directly through the Neon Data API, as the Postgres role
-- "authenticated". So every rule about who may see or change what lives here, in row-level
-- security policies and column grants. The app's own checks only decide what to show.
--
-- Roles: one super admin (reviews links, edits everything), admins (manage the team),
-- members (see links, suggest new ones).

-- People who may use Linkboard. A row is the invitation: it exists before the person signs in,
-- and is tied to their account (user_id) the first time they do.
create table public.members (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null default '',
    role text not null default 'member' check (role in ('super_admin', 'admin', 'member')),
    user_id uuid unique references neon_auth."user" (id) on delete set null,
    invited_by uuid references public.members (id) on delete set null,
    invited_at timestamptz not null default now(),
    joined_at timestamptz,
    constraint members_company_email check (email = lower(email) and email like '_%@caspiantech.az')
);

-- There is exactly one super admin.
create unique index members_one_super_admin on public.members ((true)) where role = 'super_admin';

-- Helpers for the policies. They run as the table owner, so they can read "members" without
-- going through its own policies (which would recurse). The schema is not exposed by the Data API.
create schema app;

create function app.member_id() returns uuid
language sql stable security definer set search_path = '' as $$
    select id from public.members where user_id = auth.uid()
$$;

create function app.member_role() returns text
language sql stable security definer set search_path = '' as $$
    select role from public.members where user_id = auth.uid()
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(app.member_role() in ('admin', 'super_admin'), false)
$$;

create function app.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(app.member_role() = 'super_admin', false)
$$;

alter table public.members alter column invited_by set default app.member_id();

-- A card on the board, for example "Jenkins".
create table public.groups (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) between 1 and 60),
    color text not null default 'graphite',
    created_at timestamptz not null default now()
);

create unique index groups_name_unique on public.groups (lower(name));

-- One URL. Links of a group that share a title are one row on the card, with one chip per
-- environment ("Retail": staging, prod).
create table public.links (
    id uuid primary key default gen_random_uuid(),
    group_id uuid references public.groups (id) on delete cascade,
    -- A suggestion may name a group that doesn't exist yet. It is created on approval.
    proposed_group text check (length(trim(proposed_group)) between 1 and 60),
    title text not null check (length(trim(title)) between 1 and 80),
    environment text check (environment = lower(trim(environment)) and length(environment) between 1 and 24),
    url text not null check (url ~* '^https?://[^\s]+$' and length(url) <= 2000),
    note text not null default '' check (length(note) <= 300),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    -- everyone: all members. admins: admins and the super admin. members: the people in link_access.
    visibility text not null default 'everyone' check (visibility in ('everyone', 'admins', 'members')),
    created_by uuid default app.member_id() references public.members (id) on delete set null,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    review_note text not null default '' check (length(review_note) <= 300),
    constraint links_has_group check (group_id is not null or proposed_group is not null),
    constraint links_approved_has_group check (status <> 'approved' or group_id is not null)
);

create index links_group on public.links (group_id);
create index links_status on public.links (status);

-- Who may see a link whose visibility is "members".
create table public.link_access (
    link_id uuid not null references public.links (id) on delete cascade,
    member_id uuid not null references public.members (id) on delete cascade,
    primary key (link_id, member_id)
);

create index link_access_member on public.link_access (member_id);

-- Called by the app after sign-in. Ties the account to its invitation (matched by a verified
-- email) and returns the member, or null when this account was never invited.
create function public.claim_membership() returns public.members
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    member public.members;
begin
    select id, lower(email) as email, coalesce(name, '') as name, "emailVerified" as verified
    into account
    from neon_auth."user"
    where id = auth.uid();

    if account.id is null or not coalesce(account.verified, false) then
        return null;
    end if;

    update public.members
    set user_id = account.id,
        joined_at = now(),
        name = case when name = '' then account.name else name end
    where email = account.email and user_id is null;

    select * into member from public.members where user_id = account.id;
    if member.id is null then
        return null;
    end if;
    return member;
end
$$;

revoke all on function public.claim_membership() from public;
grant execute on function public.claim_membership() to authenticated;

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
grant usage on schema public to authenticated;

-- Members: everyone on the team sees the team. Admins invite, change roles and remove people,
-- but nobody can touch the super admin's row or create a second one.
alter table public.members enable row level security;

grant select on public.members to authenticated;
grant insert (email, name, role) on public.members to authenticated;
grant update (name, role) on public.members to authenticated;
grant delete on public.members to authenticated;

create policy members_read on public.members for select to authenticated
    using ((select app.member_id()) is not null);

create policy members_invite on public.members for insert to authenticated
    with check ((select app.is_admin()) and role in ('admin', 'member'));

create policy members_change on public.members for update to authenticated
    using ((select app.is_admin()) and role <> 'super_admin')
    with check (role in ('admin', 'member'));

create policy members_remove on public.members for delete to authenticated
    using ((select app.is_admin()) and role <> 'super_admin');

-- Groups: everyone reads, the super admin edits.
alter table public.groups enable row level security;

grant select, insert, update, delete on public.groups to authenticated;

create policy groups_read on public.groups for select to authenticated
    using ((select app.member_id()) is not null);

create policy groups_write on public.groups for all to authenticated
    using ((select app.is_super_admin()))
    with check ((select app.is_super_admin()));

-- Link access: the super admin edits, a member sees their own entries.
alter table public.link_access enable row level security;

grant select, insert, update, delete on public.link_access to authenticated;

create policy link_access_read on public.link_access for select to authenticated
    using (member_id = (select app.member_id()) or (select app.is_super_admin()));

create policy link_access_write on public.link_access for all to authenticated
    using ((select app.is_super_admin()))
    with check ((select app.is_super_admin()));

-- Links: a member sees approved links they are allowed to see, and their own suggestions.
-- Anyone may suggest a link, but only as pending and visible to everyone. The super admin
-- reviews and edits. A member may remove their own suggestions that are not on the board.
alter table public.links enable row level security;

grant select, delete on public.links to authenticated;
grant insert (group_id, proposed_group, title, environment, url, note, status, visibility, reviewed_at)
    on public.links to authenticated;
grant update (group_id, proposed_group, title, environment, url, note, status, visibility, reviewed_at, review_note)
    on public.links to authenticated;

create policy links_read on public.links for select to authenticated
    using (
        (select app.is_super_admin())
        or created_by = (select app.member_id())
        or (
            status = 'approved'
            and (
                (visibility = 'everyone' and (select app.member_id()) is not null)
                or (visibility = 'admins' and (select app.is_admin()))
                or (
                    visibility = 'members'
                    and exists (
                        select 1 from public.link_access a
                        where a.link_id = links.id and a.member_id = (select app.member_id())
                    )
                )
            )
        )
    );

create policy links_suggest on public.links for insert to authenticated
    with check (
        created_by = (select app.member_id())
        and (
            (select app.is_super_admin())
            or (status = 'pending' and visibility = 'everyone' and reviewed_at is null)
        )
    );

create policy links_edit on public.links for update to authenticated
    using ((select app.is_super_admin()))
    with check ((select app.is_super_admin()));

create policy links_remove on public.links for delete to authenticated
    using (
        (select app.is_super_admin())
        or (created_by = (select app.member_id()) and status <> 'approved')
    );
