-- Category managers, and reordering for the super admin only.
--
-- Besides their role in the organization, a person can manage any number of categories
-- (a frontend lead manages "Frontend"). In the categories they manage they can add links
-- straight to the board, edit and delete links, and review what others suggest.
-- They can't touch links of other categories, links without a category, or links that
-- the super admin restricted to some people.

create table public.category_managers (
    category_id uuid not null references public.categories (id) on delete cascade,
    member_id uuid not null references public.members (id) on delete cascade,
    primary key (category_id, member_id)
);

create index category_managers_member on public.category_managers (member_id);

create function app.category_org(category uuid) returns uuid
language sql stable security definer set search_path = '' as $$
    select org_id from public.categories where id = category
$$;

-- Whether the signed-in person manages this category.
create function app.manages(category uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select category is not null and exists (
        select 1
        from public.category_managers cm join public.members m on m.id = cm.member_id
        where cm.category_id = category and m.user_id = auth.uid()
    )
$$;

-- Whether the signed-in person manages any category of this organization.
create function app.manages_any(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1
        from public.category_managers cm
            join public.members m on m.id = cm.member_id
            join public.categories c on c.id = cm.category_id
        where c.org_id = org and m.org_id = org and m.user_id = auth.uid()
    )
$$;

revoke all on function app.category_org(uuid), app.manages(uuid), app.manages_any(uuid) from public;
grant execute on function app.category_org(uuid), app.manages(uuid), app.manages_any(uuid) to authenticated;

-- Who manages what is visible to the whole organization. Admins and the super admin decide it,
-- and only for people of the category's own organization.
alter table public.category_managers enable row level security;

grant select, insert, delete on public.category_managers to authenticated;

create policy category_managers_read on public.category_managers for select to authenticated
    using (app.is_member(app.category_org(category_id)));

create policy category_managers_assign on public.category_managers for insert to authenticated
    with check (
        app.is_admin(app.category_org(category_id))
        and exists (select 1 from public.members m where m.id = member_id and m.org_id = app.category_org(category_id))
    );

create policy category_managers_unassign on public.category_managers for delete to authenticated
    using (app.is_admin(app.category_org(category_id)));

-- Links: the rules of 002, plus what a category's manager may do.
drop policy links_read on public.links;
drop policy links_suggest on public.links;
drop policy links_edit on public.links;
drop policy links_remove on public.links;

create policy links_read on public.links for select to authenticated
    using (
        app.is_super_admin(org_id)
        or created_by = app.member_id(org_id)
        -- A manager sees what waits for review (or was rejected) in their categories.
        or (status <> 'approved' and app.manages(category_id))
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
            or (app.manages(category_id) and visibility = 'everyone')
            or (status = 'pending' and visibility = 'everyone' and reviewed_at is null)
        )
    );

-- "using" is about the link as it is, "with check" about what it becomes: a manager can't
-- take over a link of another category, nor move one of theirs out of their categories.
create policy links_edit on public.links for update to authenticated
    using (app.is_super_admin(org_id) or (app.manages(category_id) and visibility = 'everyone'))
    with check (app.is_super_admin(org_id) or (app.manages(category_id) and visibility = 'everyone'));

create policy links_remove on public.links for delete to authenticated
    using (
        app.is_super_admin(org_id)
        or (app.manages(category_id) and visibility = 'everyone')
        or (created_by = app.member_id(org_id) and status <> 'approved')
    );

-- A manager who approves a suggestion for a new group, or adds a link to one, may start that group.
-- Renaming, recoloring and deleting groups stays with the super admin.
create policy groups_start on public.groups for insert to authenticated
    with check (app.manages_any(org_id));

-- The team's order is the super admin's to change, for now.
create or replace function public.set_group_order(org uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not app.is_super_admin(org) then
        raise exception 'Only the super admin can change the order for everyone.' using errcode = '42501';
    end if;
    update public.groups g
    set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where g.id = listed.id and g.org_id = org;
end
$$;

create or replace function public.set_link_order(group_id uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
    org uuid;
begin
    select g.org_id into org from public.groups g where g.id = set_link_order.group_id;
    if org is null or not app.is_super_admin(org) then
        raise exception 'Only the super admin can change the order for everyone.' using errcode = '42501';
    end if;
    update public.links l
    set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where l.id = listed.id and l.group_id = set_link_order.group_id;
end
$$;
