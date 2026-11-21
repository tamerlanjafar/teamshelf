-- An open space (visibility 'org') is seen by everyone in its organization, and anyone there can
-- suggest links. Being a plain member of it adds nothing, so an open space lists only its admins.
--
-- Opening a private space removes its plain members, keeping its admins. People whose invitation
-- is still waiting for approval keep their row: it says which space they were invited to.

create function app.open_spaces_keep_admins() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if new.visibility = 'org' and old.visibility <> 'org' then
        delete from public.space_members sm
        using public.members m
        where sm.space_id = new.id and sm.role = 'member' and m.id = sm.member_id and m.approved;
    end if;
    return new;
end
$$;

revoke all on function app.open_spaces_keep_admins() from public;

-- After only_admins_open_spaces (a BEFORE trigger) has let the change through.
create trigger spaces_open_keeps_admins after update of visibility on public.spaces
    for each row execute function app.open_spaces_keep_admins();

-- The open spaces of today, the same way.
delete from public.space_members sm
using public.spaces s, public.members m
where s.id = sm.space_id and s.visibility = 'org' and sm.role = 'member' and m.id = sm.member_id and m.approved;
