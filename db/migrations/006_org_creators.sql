-- Only the people listed here may create organizations.
--
-- The list is kept in the database and checked inside create_org(), so it can't be got around
-- from the browser. It is changed with SQL only (nobody can read or write it through the Data API):
--
--   insert into public.org_creators (email) values ('you@example.com');
--   delete from public.org_creators where email = 'you@example.com';

create table public.org_creators (
    email text primary key check (email = lower(email)),
    added_at timestamptz not null default now()
);

-- No grants and no policies: closed to everyone but the database owner.
alter table public.org_creators enable row level security;

create function app.can_create_org(email text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.org_creators c where c.email = lower(can_create_org.email))
$$;

revoke all on function app.can_create_org(text) from public, authenticated;

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
    if not app.can_create_org(account.email) then
        raise exception 'This account can''t create organizations.' using errcode = '42501';
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

-- The app asks this to know whether to offer "Create an organization".
create or replace function public.my_orgs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    account record;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('orgs', '[]'::jsonb, 'joinable', '[]'::jsonb, 'can_create', false);
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
        ),
        'can_create', app.can_create_org(account.email)
    );
end
$$;
