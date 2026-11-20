-- Fewer spaces to start with: Development, Design, Product and Data. DevOps, QA and People are
-- removed where they are still empty, and new organizations no longer get them.

delete from public.spaces s
where s.slug in ('devops', 'qa', 'people')
    and not exists (select 1 from public.groups g where g.space_id = s.id)
    and not exists (select 1 from public.links l where l.space_id = s.id);

create or replace function app.add_default_spaces(org uuid, creator uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.spaces (org_id, slug, name, logo, color, position) values
        (org, 'development', 'Development', 'code', 'indigo', 1),
        (org, 'design', 'Design', 'pen-tool', 'pink', 2),
        (org, 'product', 'Product', 'compass', 'orange', 3),
        (org, 'data', 'Data', 'chart', 'teal', 4);
    if creator is not null then
        insert into public.space_members (space_id, member_id, role)
        select s.id, creator, 'admin' from public.spaces s where s.org_id = org;
    end if;
end
$$;

revoke all on function app.add_default_spaces(uuid, uuid) from public, authenticated;
