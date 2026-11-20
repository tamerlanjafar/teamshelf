-- Closing gaps left by 002.

-- 1. Helper functions that change data are only for the functions that call them (which run as
--    the owner), not for signed-in people. Policies only need the membership checks.
revoke execute on function app.add_default_categories(uuid), app.claim_invitations(uuid), app.account(),
    app.stamp_link_author(), app.stamp_inviter() from authenticated;

-- 2. Someone removed from an organization can't walk back in through its allowed domain.
--    Inviting them again lifts the block.
create table public.removed_members (
    org_id uuid not null references public.orgs (id) on delete cascade,
    email text not null,
    removed_at timestamptz not null default now(),
    primary key (org_id, email)
);

-- Nobody reads or writes this through the Data API: no grants, and no policies.
alter table public.removed_members enable row level security;

create function app.remember_removed_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    -- Not when the whole organization is being deleted.
    if exists (select 1 from public.orgs where id = old.org_id) then
        insert into public.removed_members (org_id, email) values (old.org_id, old.email)
        on conflict (org_id, email) do update set removed_at = now();
    end if;
    return old;
end
$$;

create trigger members_remember_removed after delete on public.members
    for each row execute function app.remember_removed_member();

create function app.forget_removed_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    delete from public.removed_members where org_id = new.org_id and email = new.email;
    return new;
end
$$;

create trigger members_forget_removed after insert on public.members
    for each row execute function app.forget_removed_member();

revoke all on function app.remember_removed_member(), app.forget_removed_member() from public, authenticated;

-- Whether this person may join the organization without an invitation.
create function app.can_join(org public.orgs, email text) returns boolean
language sql stable security definer set search_path = '' as $$
    select split_part(email, '@', 2) = any (org.allowed_domains)
        and not exists (select 1 from public.removed_members r where r.org_id = org.id and r.email = can_join.email)
$$;

revoke all on function app.can_join(public.orgs, text) from public, authenticated;

create or replace function public.my_orgs() returns jsonb
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
            where app.can_join(o, account.email)
                and not exists (select 1 from public.members m where m.org_id = o.id and m.user_id = account.id)
        )
    );
end
$$;

create or replace function public.open_org(org_slug text) returns jsonb
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
    if app.can_join(org, account.email) then
        return jsonb_build_object('org', jsonb_build_object('slug', org.slug, 'name', org.name), 'member', null, 'can_join', true);
    end if;
    return null;
end
$$;

create or replace function public.join_org(org_slug text) returns public.members
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
    member public.members;
begin
    select * into account from app.account();
    select * into org from public.orgs where slug = lower(org_slug);
    if account.id is null or org.id is null or not app.can_join(org, account.email) then
        raise exception 'You can''t join this organization without an invitation.' using errcode = '42501';
    end if;

    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'member', account.id, now())
    on conflict (org_id, email) do update set user_id = excluded.user_id, joined_at = now()
        where public.members.user_id is null
    returning * into member;
    return member;
end
$$;

-- 3. One account can't create organizations without end.
create or replace function public.create_org(org_name text, org_slug text) returns public.orgs
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
begin
    select * into account from app.account();
    if account.id is null then
        raise exception 'Sign in to create an organization.' using errcode = '42501';
    end if;
    if (select count(*) from public.members where user_id = account.id and role = 'super_admin') >= 10 then
        raise exception 'You have created the most organizations one account can have.' using errcode = '42501';
    end if;

    insert into public.orgs (name, slug) values (trim(org_name), lower(trim(org_slug))) returning * into org;
    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'super_admin', account.id, now());
    perform app.add_default_categories(org.id);
    return org;
end
$$;

-- 4. Limits on what one person or one organization can store.
alter table public.member_prefs add constraint member_prefs_size check (
    cardinality(group_order) <= 2000
    and cardinality(hidden_groups) <= 2000
    and cardinality(hidden_links) <= 20000
    and pg_column_size(link_order) <= 1000000
);

alter table public.orgs add constraint orgs_domains_count check (cardinality(allowed_domains) <= 20);
