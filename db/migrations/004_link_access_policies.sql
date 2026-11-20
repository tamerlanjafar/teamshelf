-- The policies of "links" look at "link_access", and those of "link_access" looked back at
-- "links", which Postgres refuses as endless recursion. They now ask a helper for the link's
-- organization instead.

create function app.link_org(link uuid) returns uuid
language sql stable security definer set search_path = '' as $$
    select org_id from public.links where id = link
$$;

revoke all on function app.link_org(uuid) from public;
grant execute on function app.link_org(uuid) to authenticated;

drop policy link_access_read on public.link_access;
drop policy link_access_grant on public.link_access;
drop policy link_access_revoke on public.link_access;

-- A member sees their own entries, the link's super admin sees all of them.
create policy link_access_read on public.link_access for select to authenticated
    using (
        member_id = app.member_id(app.link_org(link_id))
        or app.is_super_admin(app.link_org(link_id))
    );

-- The link's super admin gives access, and only to people of the link's own organization.
create policy link_access_grant on public.link_access for insert to authenticated
    with check (
        app.is_super_admin(app.link_org(link_id))
        and exists (select 1 from public.members m where m.id = member_id and m.org_id = app.link_org(link_id))
    );

create policy link_access_revoke on public.link_access for delete to authenticated
    using (app.is_super_admin(app.link_org(link_id)));
