-- A new organization starts with no spaces: its people create the ones they need. (It used to
-- start with Development, Design, Product and Data.) Organizations that exist keep their spaces.

create or replace function public.create_org(org_name text, org_slug text) returns public.orgs
    language plpgsql security definer
    set search_path to ''
    as $$
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
    if (select count(*) from public.orgs where created_by = account.id) >= 10 then
        raise exception 'You have created the most organizations one account can have.' using errcode = '42501';
    end if;

    insert into public.orgs (name, slug, created_by) values (trim(org_name), lower(trim(org_slug)), account.id) returning * into org;
    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'admin', account.id, now());
    return org;
end
$$;

drop function app.add_default_spaces(uuid, uuid);
