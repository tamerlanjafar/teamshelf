-- A new space starts private for everyone, Org Admins too: only the person who creates it (its
-- first admin) sees it, until they add people or open it to the organization.

create or replace function public.create_space(org uuid, space_name text, space_slug text, space_logo text default 'grid'::text, space_color text default 'indigo'::text) returns public.spaces
    language plpgsql security definer
    set search_path to ''
    as $$
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
    values (org, lower(trim(space_slug)), trim(space_name), space_logo, space_color, 'private',
            coalesce((select max(position) from public.spaces where org_id = org), 0) + 1)
    returning * into space;
    insert into public.space_members (space_id, member_id, role) values (space.id, app.member_id(org), 'admin');
    return space;
end
$$;
