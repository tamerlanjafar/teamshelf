-- Having suggested a link gave you that link for good: you still read it after it was approved
-- and restricted to admins or chosen people, and after you were taken out of its private space.
--
-- Now a link is read by who has access to it, whoever suggested it:
--   - on the board (approved): the usual rule (everyone who sees the space, its admins, or the
--     chosen people);
--   - your own suggestion that waits or was rejected: still yours to see (with the reason) and to
--     remove, while you can see its space.
-- Nothing is deleted: a suggestion you can no longer see is still there for the space's admins.

drop policy links_read on public.links;

create policy links_read on public.links for select to authenticated using (
    app.is_space_admin(space_id)
    or (created_by = app.member_id(org_id) and status <> 'approved' and app.can_see_space(space_id))
    or (
        status = 'approved' and app.can_see_space(space_id)
        and (
            visibility = 'everyone'
            or (visibility = 'members' and exists (
                select 1 from public.link_access a where a.link_id = links.id and a.member_id = app.member_id(links.org_id)
            ))
        )
    )
);
