-- One kind of organization admin, spaces anyone can start, and invitations from a space.
--
-- 1. The super admin goes. An organization has admins and members. Its admins invite and remove
--    people, change roles and its settings. They don't run every space: a space is run by its own
--    admins, who may or may not be admins of the organization.
-- 2. Any member can create a space, and becomes its admin. Only admins of the organization open a
--    space to everyone in it: anyone else's spaces are private, to the people they add.
-- 3. A space's admins can invite someone by email. Someone already in the organization is added
--    to the space at once. Someone new is invited to the organization too, at once when the
--    organization lets their email's domain in (or an admin of the organization invites them),
--    and otherwise waiting until an admin of the organization approves.
-- 4. An organization always keeps an admin, and a space always keeps an admin.

-- ---- 1. No more super admins ----------------------------------------------------------------

-- Who created an organization, for the limit of organizations one account can create (it counted
-- super admins until now).
alter table public.orgs add column created_by uuid;
update public.orgs o set created_by = m.user_id
from public.members m where m.org_id = o.id and m.role = 'super_admin';

-- The super admin was an admin of every space. Before that ends, every space without an admin of
-- its own gets its organization's super admin as one, so no space is left without an admin.
insert into public.space_members (space_id, member_id, role)
select s.id, m.id, 'admin'
from public.spaces s join public.members m on m.org_id = s.org_id and m.role = 'super_admin'
where not exists (select 1 from public.space_members sm where sm.space_id = s.id and sm.role = 'admin')
on conflict (space_id, member_id) do update set role = 'admin';

drop index public.members_one_super_admin;
update public.members set role = 'admin' where role = 'super_admin';
alter table public.members drop constraint members_role_check;
alter table public.members add constraint members_role_check check (role in ('admin', 'member'));

create or replace function app.is_admin(org uuid) returns boolean
    language sql stable security definer set search_path = '' as $$
    select coalesce(app.member_role(org) = 'admin', false)
$$;

create or replace function app.is_space_admin(space uuid) returns boolean
    language sql stable security definer set search_path = '' as $$
    select coalesce(app.space_role(space) = 'admin' and app.is_member(app.space_org(space)), false)
$$;

create or replace function app.can_see_space(space uuid) returns boolean
    language sql stable security definer set search_path = '' as $$
    select coalesce((
        select app.is_member(s.org_id) and (s.visibility = 'org' or app.space_role(s.id) is not null)
        from public.spaces s where s.id = space
    ), false)
$$;

drop policy orgs_change on public.orgs;
create policy orgs_change on public.orgs for update to authenticated
    using (app.is_admin(id)) with check (app.is_admin(id));

drop policy members_change on public.members;
create policy members_change on public.members for update to authenticated
    using (app.is_admin(org_id)) with check (role in ('admin', 'member'));

drop policy members_remove on public.members;
create policy members_remove on public.members for delete to authenticated
    using (app.is_admin(org_id));

create or replace function public.set_space_order(org uuid, ids uuid[]) returns void
    language plpgsql security definer set search_path = '' as $$
begin
    if not app.is_admin(org) then
        raise exception 'Only admins of the organization can change the order of spaces.' using errcode = '42501';
    end if;
    update public.spaces s set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where s.id = listed.id and s.org_id = org;
end
$$;

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
    if (select count(*) from public.orgs where created_by = account.id) >= 10 then
        raise exception 'You have created the most organizations one account can have.' using errcode = '42501';
    end if;

    insert into public.orgs (name, slug, created_by) values (trim(org_name), lower(trim(org_slug)), account.id) returning * into org;
    insert into public.members (org_id, email, name, role, user_id, joined_at)
    values (org.id, account.email, account.name, 'admin', account.id, now())
    returning id into creator;
    perform app.add_default_spaces(org.id, creator);
    return org;
end
$$;

drop function app.is_super_admin(uuid);

-- ---- 2. Any member creates spaces ----------------------------------------------------------

create or replace function public.create_space(org uuid, space_name text, space_slug text, space_logo text default 'grid', space_color text default 'indigo')
    returns public.spaces
    language plpgsql security definer set search_path = '' as $$
declare
    space public.spaces;
begin
    if not app.is_member(org) then
        raise exception 'Only people in the organization can create spaces.' using errcode = '42501';
    end if;
    if (select count(*) from public.spaces where org_id = org) >= 50 then
        raise exception 'An organization can have up to 50 spaces.' using errcode = '42501';
    end if;
    insert into public.spaces (org_id, slug, name, logo, color, visibility, position)
    values (org, lower(trim(space_slug)), trim(space_name), space_logo, space_color,
            case when app.is_admin(org) then 'org' else 'private' end,
            coalesce((select max(position) from public.spaces where org_id = org), 0) + 1)
    returning * into space;
    insert into public.space_members (space_id, member_id, role) values (space.id, app.member_id(org), 'admin');
    return space;
end
$$;

-- Opening a space to the whole organization is for its admins, also later, from the space's settings.
create function app.only_admins_open_spaces() returns trigger
    language plpgsql security definer set search_path = '' as $$
begin
    if new.visibility = 'org' and old.visibility <> 'org' and auth.uid() is not null and not app.is_admin(new.org_id) then
        raise exception 'Only admins of the organization can open a space to everyone in it.' using errcode = '42501';
    end if;
    return new;
end
$$;
revoke all on function app.only_admins_open_spaces() from public, authenticated;
create trigger spaces_only_admins_open before update of visibility on public.spaces
    for each row execute function app.only_admins_open_spaces();

-- ---- 3. Invitations from a space -----------------------------------------------------------

-- false: invited from a space, from outside what the organization lets in. It waits for an admin
-- of the organization, and can't be taken up until then.
alter table public.members add column approved boolean not null default true;
grant update (approved) on public.members to authenticated;

-- Only approved invitations are taken up when someone signs in.
create or replace function app.claim_invitations(only_org uuid default null) returns void
    language sql security definer set search_path = '' as $$
    update public.members m
    set user_id = a.id,
        joined_at = now(),
        name = case when m.name = '' then a.name else m.name end
    from app.account() a
    where m.email = a.email
        and m.user_id is null
        and m.approved
        and (only_org is null or m.org_id = only_org)
$$;

-- Joining through an allowed domain also takes up an invitation still waiting for approval.
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
    on conflict (org_id, email) do update set user_id = excluded.user_id, joined_at = now(), approved = true
        where public.members.user_id is null
    returning * into member;
    return member;
end
$$;

-- Someone removed earlier is let back in once an invitation for them is approved, not before.
create or replace function app.forget_removed_member() returns trigger
    language plpgsql security definer set search_path = '' as $$
begin
    if new.approved then
        delete from public.removed_members where org_id = new.org_id and email = new.email;
    end if;
    return new;
end
$$;
drop trigger members_forget_removed on public.members;
create trigger members_forget_removed after insert or update of approved on public.members
    for each row execute function app.forget_removed_member();

-- Turning down an invitation that waited for approval isn't removing someone: it doesn't stop
-- their email's domain from letting them in later.
create or replace function app.remember_removed_member() returns trigger
    language plpgsql security definer set search_path = '' as $$
begin
    -- Not when the whole organization is being deleted.
    if old.approved and exists (select 1 from public.orgs where id = old.org_id) then
        insert into public.removed_members (org_id, email) values (old.org_id, old.email)
        on conflict (org_id, email) do update set removed_at = now();
    end if;
    return old;
end
$$;

-- A space's admins invite someone by email. Answers what happened: "added" (already in the
-- organization), "invited" (they join when they sign in) or "waiting" (for an admin of the
-- organization to approve).
create function public.invite_to_space(space uuid, invitee_email text, invitee_role text default 'member') returns text
    language plpgsql security definer set search_path = '' as $$
declare
    org public.orgs;
    address text := lower(trim(invitee_email));
    member public.members;
begin
    if not app.is_space_admin(space) then
        raise exception 'Only the space''s admins can invite people to it.' using errcode = '42501';
    end if;
    if invitee_role not in ('admin', 'member') then
        raise exception 'Choose member or admin.' using errcode = '22023';
    end if;
    select o.* into org from public.orgs o join public.spaces s on s.org_id = o.id where s.id = space;

    select * into member from public.members where org_id = org.id and email = address;
    if member.id is null then
        insert into public.members (org_id, email, role, approved)
        values (org.id, address, 'member', app.is_admin(org.id) or app.can_join(org, address))
        returning * into member;
    elsif not member.approved and app.is_admin(org.id) then
        -- An admin of the organization inviting someone who waits for approval approves them.
        update public.members set approved = true where id = member.id returning * into member;
    end if;

    insert into public.space_members (space_id, member_id, role) values (space, member.id, invitee_role)
    on conflict (space_id, member_id) do update set role = excluded.role;

    return case when member.user_id is not null then 'added' when member.approved then 'invited' else 'waiting' end;
end
$$;
revoke all on function public.invite_to_space(uuid, text, text) from public;
grant execute on function public.invite_to_space(uuid, text, text) to authenticated;

-- ---- 4. Always an admin --------------------------------------------------------------------

-- The last admin of an organization (one who has signed in) can't stop being one.
create function app.keep_an_org_admin() returns trigger
    language plpgsql security definer set search_path = '' as $$
begin
    if old.role = 'admin' and old.user_id is not null
        and (tg_op = 'DELETE' or new.role <> 'admin')
        and exists (select 1 from public.orgs where id = old.org_id)
        and not exists (
            select 1 from public.members m
            where m.org_id = old.org_id and m.role = 'admin' and m.user_id is not null and m.id <> old.id
        ) then
        raise exception 'An organization needs an admin. Make someone else an admin first.' using errcode = 'P0001';
    end if;
    return coalesce(new, old);
end
$$;
revoke all on function app.keep_an_org_admin() from public, authenticated;
create trigger members_keep_an_admin before update of role or delete on public.members
    for each row execute function app.keep_an_org_admin();

-- The last admin of a space can't leave it or stop being its admin, also not by leaving the
-- organization. Deleting the space itself is fine.
create function app.keep_a_space_admin() returns trigger
    language plpgsql security definer set search_path = '' as $$
begin
    if old.role = 'admin'
        and (tg_op = 'DELETE' or new.role <> 'admin')
        and exists (select 1 from public.spaces where id = old.space_id)
        and not exists (
            select 1 from public.space_members sm
            where sm.space_id = old.space_id and sm.role = 'admin' and sm.member_id <> old.member_id
        ) then
        raise exception 'A space needs an admin. Make someone else an admin of % first.',
            (select name from public.spaces where id = old.space_id) using errcode = 'P0001';
    end if;
    return coalesce(new, old);
end
$$;
revoke all on function app.keep_a_space_admin() from public, authenticated;
create trigger space_members_keep_an_admin before update of role or delete on public.space_members
    for each row execute function app.keep_a_space_admin();
