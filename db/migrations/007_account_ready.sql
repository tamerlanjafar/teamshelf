-- Right after someone's first sign-in, a request can arrive before their account is fully in
-- place (its email not yet marked as verified). my_orgs() and open_org() used to answer such
-- a request as if the person had no organizations and no rights. They now say "not ready",
-- so the app can ask again a moment later instead of showing a wrong page.

create or replace function public.my_orgs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    account record;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('ready', false);
    end if;

    perform app.claim_invitations();

    return jsonb_build_object(
        'ready', true,
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

-- Returns { ready: false } when the account isn't in place yet, { ready: true, access: … } otherwise.
-- "access" is null when the organization doesn't exist or isn't this person's to see.
create or replace function public.open_org(org_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    account record;
    org public.orgs;
    member public.members;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('ready', false);
    end if;

    select * into org from public.orgs where slug = lower(org_slug);
    if org.id is null then
        return jsonb_build_object('ready', true, 'access', null);
    end if;

    perform app.claim_invitations(org.id);
    select * into member from public.members where org_id = org.id and user_id = account.id;

    if member.id is not null then
        return jsonb_build_object('ready', true, 'access', jsonb_build_object('org', to_jsonb(org), 'member', to_jsonb(member), 'can_join', false));
    end if;
    if app.can_join(org, account.email) then
        return jsonb_build_object('ready', true, 'access', jsonb_build_object('org', jsonb_build_object('slug', org.slug, 'name', org.name), 'member', null, 'can_join', true));
    end if;
    return jsonb_build_object('ready', true, 'access', null);
end
$$;
