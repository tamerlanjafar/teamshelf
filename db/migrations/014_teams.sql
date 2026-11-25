-- Teams: named sets of people in an organization ("Backend", "On call"), so a private space, a
-- group or a link can be given to a whole team at once instead of to one person at a time.
--
-- Admins of the organization create teams, rename and delete them, and choose who is in them.
-- They can also let some people manage teams (members.manages_teams): those create teams, and
-- change or delete the ones they created, not anyone else's. Everyone in the organization sees
-- the teams and who is in them. What a team was given follows
-- the team: someone added to it sees what it was given, and stops seeing it when taken out.
--
--   - A private space can take in teams (space_teams): everyone in them is a member of the space.
--     Never an admin: admins are named one by one, so "a space keeps an admin" stays about people.
--   - A link shown to chosen people can be shown to teams too (link_team_access).
--   - Groups get the choice links have: everyone who sees the space, its admins, or chosen people
--     and teams (group_access, group_team_access). A group someone can't see hides its folders and
--     links from them too.
--
-- Apply before the app that reads it is deployed: the app reads groups.visibility and the teams.

-- ---- Teams ----------------------------------------------------------------------------------

alter table public.members add constraint members_id_org_key unique (id, org_id);

-- Someone an admin of the organization lets create teams and manage the ones they created.
alter table public.members add column manages_teams boolean default false not null;
grant update (manages_teams) on table public.members to authenticated;

create table public.teams (
    id uuid default gen_random_uuid() primary key,
    org_id uuid not null references public.orgs(id) on delete cascade,
    name text not null,
    -- Who created it: they may change it while they manage teams. Gone when they leave the
    -- organization; then only its admins change it.
    created_by uuid references public.members(id) on delete set null,
    created_at timestamp with time zone default now() not null,
    constraint teams_name_check check (name = trim(name) and length(name) between 1 and 40),
    constraint teams_id_org_key unique (id, org_id)
);

-- Two teams of one organization don't share a name (ignoring case).
create unique index teams_name_unique on public.teams (org_id, lower(name));

create table public.team_members (
    team_id uuid not null,
    member_id uuid not null,
    org_id uuid not null,
    added_at timestamp with time zone default now() not null,
    primary key (team_id, member_id),
    constraint team_members_team_fkey foreign key (team_id, org_id) references public.teams(id, org_id) on delete cascade,
    constraint team_members_member_fkey foreign key (member_id, org_id) references public.members(id, org_id) on delete cascade
);

create index team_members_member on public.team_members (member_id);

-- Whether the signed-in person creates teams in this organization: its admins, and the people
-- they let manage teams.
create function app.can_create_teams(org uuid) returns boolean
    language sql stable security definer
    set search_path to ''
    as $$
    select coalesce((select m.role = 'admin' or m.manages_teams from public.members m where m.org_id = org and m.user_id = auth.uid()), false)
$$;

-- Whether the signed-in person changes this team: an admin of the organization, or its creator
-- while they still manage teams.
create function app.can_edit_team(team uuid) returns boolean
    language sql stable security definer
    set search_path to ''
    as $$
    select coalesce((
        select app.is_admin(t.org_id) or (app.can_create_teams(t.org_id) and t.created_by = app.member_id(t.org_id))
        from public.teams t where t.id = team
    ), false)
$$;

revoke all on function app.can_create_teams(uuid) from public;
revoke all on function app.can_edit_team(uuid) from public;
grant execute on function app.can_create_teams(uuid), app.can_edit_team(uuid) to authenticated;

-- A new team's creator is whoever creates it.
create function app.stamp_team_creator() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if auth.uid() is not null then
        new.created_by := app.member_id(new.org_id);
    end if;
    return new;
end
$$;

revoke all on function app.stamp_team_creator() from public;

create trigger teams_stamp_creator before insert on public.teams
    for each row execute function app.stamp_team_creator();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy teams_read on public.teams for select to authenticated using (app.is_member(org_id));
create policy teams_create on public.teams for insert to authenticated with check (app.can_create_teams(org_id));
create policy teams_change on public.teams for update to authenticated using (app.can_edit_team(id)) with check (app.can_edit_team(id));
create policy teams_delete on public.teams for delete to authenticated using (app.can_edit_team(id));
create policy team_members_read on public.team_members for select to authenticated using (app.is_member(org_id));
create policy team_members_add on public.team_members for insert to authenticated with check (app.can_edit_team(team_id));
create policy team_members_remove on public.team_members for delete to authenticated using (app.can_edit_team(team_id));

grant select, delete on table public.teams to authenticated;
grant insert (org_id, name), update (name) on table public.teams to authenticated;
grant select, insert, delete on table public.team_members to authenticated;

-- Up to 100 teams per organization.
create function app.limit_teams() returns trigger
    language plpgsql
    set search_path to ''
    as $$
begin
    if auth.uid() is not null and (select count(*) from public.teams t where t.org_id = new.org_id) >= 100 then
        raise exception 'An organization can have up to 100 teams.' using errcode = 'P0001';
    end if;
    return new;
end
$$;

revoke all on function app.limit_teams() from public;

create trigger teams_within_limits before insert on public.teams
    for each row execute function app.limit_teams();

-- Whether the signed-in person is in this team.
create function app.in_team(team uuid) returns boolean
    language sql stable security definer
    set search_path to ''
    as $$
    select exists (
        select 1 from public.team_members tm join public.members m on m.id = tm.member_id
        where tm.team_id = team and m.user_id = auth.uid()
    )
$$;

revoke all on function app.in_team(uuid) from public;
grant execute on function app.in_team(uuid) to authenticated;

-- ---- Teams in a private space ----------------------------------------------------------------

create table public.space_teams (
    space_id uuid not null,
    team_id uuid not null,
    org_id uuid not null,
    added_at timestamp with time zone default now() not null,
    primary key (space_id, team_id),
    constraint space_teams_space_fkey foreign key (space_id, org_id) references public.spaces(id, org_id) on delete cascade,
    constraint space_teams_team_fkey foreign key (team_id, org_id) references public.teams(id, org_id) on delete cascade
);

create index space_teams_team on public.space_teams (team_id);

alter table public.space_teams enable row level security;

create policy space_teams_read on public.space_teams for select to authenticated using (app.can_see_space(space_id));
create policy space_teams_add on public.space_teams for insert to authenticated with check (app.is_space_admin(space_id));
create policy space_teams_remove on public.space_teams for delete to authenticated using (app.is_space_admin(space_id));

grant select, insert, delete on table public.space_teams to authenticated;

-- Someone's role in a space: their own, or member through a team the space took in.
create or replace function app.space_role(space uuid) returns text
    language sql stable security definer
    set search_path to ''
    as $$
    select coalesce(
        (
            select sm.role
            from public.space_members sm join public.members m on m.id = sm.member_id
            where sm.space_id = space and m.user_id = auth.uid()
        ),
        (
            select 'member'
            from public.space_teams st
            where st.space_id = space and app.in_team(st.team_id)
            limit 1
        )
    )
$$;

-- Opening a space makes everyone a member, so its teams are taken off its list too, as its plain
-- members are (001_open_spaces_keep_admins.sql).
create or replace function app.open_spaces_keep_admins() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
    if new.visibility = 'org' and old.visibility <> 'org' then
        delete from public.space_members sm
        using public.members m
        where sm.space_id = new.id and sm.role = 'member' and m.id = sm.member_id and m.approved;
        delete from public.space_teams st where st.space_id = new.id;
    end if;
    return new;
end
$$;

-- ---- Who sees a group ------------------------------------------------------------------------

alter table public.groups add column visibility text default 'everyone' not null;
alter table public.groups add constraint groups_visibility_check check (visibility in ('everyone', 'admins', 'members'));
grant insert (visibility), update (visibility) on table public.groups to authenticated;

create function app.group_space(grp uuid) returns uuid
    language sql stable security definer
    set search_path to ''
    as $$
    select space_id from public.groups where id = grp
$$;

create function app.group_org(grp uuid) returns uuid
    language sql stable security definer
    set search_path to ''
    as $$
    select org_id from public.groups where id = grp
$$;

revoke all on function app.group_space(uuid) from public;
revoke all on function app.group_org(uuid) from public;
grant execute on function app.group_space(uuid), app.group_org(uuid) to authenticated;

create table public.group_access (
    group_id uuid not null references public.groups(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    primary key (group_id, member_id)
);

create index group_access_member on public.group_access (member_id);

create table public.group_team_access (
    group_id uuid not null references public.groups(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    primary key (group_id, team_id)
);

create index group_team_access_team on public.group_team_access (team_id);

alter table public.group_access enable row level security;
alter table public.group_team_access enable row level security;

create policy group_access_read on public.group_access for select to authenticated using (
    member_id = app.member_id(app.group_org(group_id)) or app.is_space_admin(app.group_space(group_id))
);
create policy group_access_grant on public.group_access for insert to authenticated with check (
    app.is_space_admin(app.group_space(group_id))
    and exists (select 1 from public.members m where m.id = group_access.member_id and m.org_id = app.group_org(group_access.group_id))
);
create policy group_access_revoke on public.group_access for delete to authenticated using (app.is_space_admin(app.group_space(group_id)));

create policy group_team_access_read on public.group_team_access for select to authenticated using (
    app.in_team(team_id) or app.is_space_admin(app.group_space(group_id))
);
create policy group_team_access_grant on public.group_team_access for insert to authenticated with check (
    app.is_space_admin(app.group_space(group_id))
    and exists (select 1 from public.teams t where t.id = group_team_access.team_id and t.org_id = app.group_org(group_team_access.group_id))
);
create policy group_team_access_revoke on public.group_team_access for delete to authenticated using (app.is_space_admin(app.group_space(group_id)));

grant select, insert, delete on table public.group_access, public.group_team_access to authenticated;

-- Whether the signed-in person sees a group: they see its space, and the group is for everyone
-- there, or they run the space, or they (or a team of theirs) were chosen.
create function app.can_see_group(grp uuid) returns boolean
    language sql stable security definer
    set search_path to ''
    as $$
    select coalesce((
        select app.can_see_space(g.space_id) and (
            g.visibility = 'everyone'
            or app.is_space_admin(g.space_id)
            or (g.visibility = 'members' and (
                exists (select 1 from public.group_access a where a.group_id = g.id and a.member_id = app.member_id(g.org_id))
                or exists (select 1 from public.group_team_access t where t.group_id = g.id and app.in_team(t.team_id))
            ))
        )
        from public.groups g where g.id = grp
    ), false)
$$;

revoke all on function app.can_see_group(uuid) from public;
grant execute on function app.can_see_group(uuid) to authenticated;

drop policy groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated using (app.can_see_group(id));

drop policy folders_read on public.folders;
create policy folders_read on public.folders for select to authenticated using (app.can_see_group(group_id));

-- ---- Links shown to teams --------------------------------------------------------------------

create table public.link_team_access (
    link_id uuid not null references public.links(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    primary key (link_id, team_id)
);

create index link_team_access_team on public.link_team_access (team_id);

alter table public.link_team_access enable row level security;

create policy link_team_access_read on public.link_team_access for select to authenticated using (
    app.in_team(team_id) or app.is_space_admin(app.link_space(link_id))
);
create policy link_team_access_grant on public.link_team_access for insert to authenticated with check (
    app.is_space_admin(app.link_space(link_id))
    and exists (select 1 from public.teams t where t.id = link_team_access.team_id and t.org_id = app.link_org(link_team_access.link_id))
);
create policy link_team_access_revoke on public.link_team_access for delete to authenticated using (app.is_space_admin(app.link_space(link_id)));

grant select, insert, delete on table public.link_team_access to authenticated;

-- A link on the board is read by who sees its group and is in its audience: everyone, or the
-- people and teams chosen. Own suggestions stay as in 004_own_suggestions_need_access.sql.
drop policy links_read on public.links;
create policy links_read on public.links for select to authenticated using (
    app.is_space_admin(space_id)
    or (created_by = app.member_id(org_id) and status <> 'approved' and app.can_see_space(space_id))
    or (
        status = 'approved' and app.can_see_group(group_id)
        and (
            visibility = 'everyone'
            or (visibility = 'members' and (
                exists (select 1 from public.link_access a where a.link_id = links.id and a.member_id = app.member_id(links.org_id))
                or exists (select 1 from public.link_team_access t where t.link_id = links.id and app.in_team(t.team_id))
            ))
        )
    )
);

-- A suggestion goes into a group its sender sees (or asks for a new one).
drop policy links_suggest on public.links;
create policy links_suggest on public.links for insert to authenticated with check (
    created_by = app.member_id(org_id)
    and app.can_see_space(space_id)
    and (group_id is null or app.can_see_group(group_id))
    and (app.is_space_admin(space_id) or (status = 'pending' and visibility = 'everyone' and reviewed_at is null))
);
