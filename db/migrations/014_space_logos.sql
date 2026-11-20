-- New logos for Design (shapes) and Product (a box); the pen and the compass are no longer offered.

update public.spaces set logo = 'shapes' where logo = 'pen-tool';
update public.spaces set logo = 'box' where logo = 'compass';

create or replace function app.add_default_spaces(org uuid, creator uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.spaces (org_id, slug, name, logo, color, position) values
        (org, 'development', 'Development', 'code', 'indigo', 1),
        (org, 'design', 'Design', 'shapes', 'pink', 2),
        (org, 'product', 'Product', 'box', 'orange', 3),
        (org, 'data', 'Data', 'chart', 'teal', 4);
    if creator is not null then
        insert into public.space_members (space_id, member_id, role)
        select s.id, creator, 'admin' from public.spaces s where s.org_id = org;
    end if;
end
$$;

revoke all on function app.add_default_spaces(uuid, uuid) from public, authenticated;
