-- The back office (apps/back-office): reports over every organization, for the people who run
-- this installation. Who they are is a list of emails, like org_creators: nobody reads or changes
-- it through the Data API. Change it with SQL:
--
--   insert into super_admins (email) values ('you@example.com');
--
-- The report gives numbers and names of organizations and spaces. It never gives a link, a file,
-- or anyone's email except the one that created an organization.

create table public.super_admins (
    email text primary key,
    added_at timestamp with time zone default now() not null,
    constraint super_admins_email_check check (email = lower(email))
);

alter table public.super_admins enable row level security;

create function app.is_super_admin() returns boolean
    language sql stable security definer
    set search_path to ''
    as $$
    select exists (select 1 from app.account() a join public.super_admins s on s.email = a.email)
$$;

revoke all on function app.is_super_admin() from public;

-- Everything the back office shows, in one answer. `ready` is false for a moment after a first
-- sign-in, as in my_orgs(); `allowed` is false for everyone who isn't on the list.
create function public.back_office_report() returns jsonb
    language plpgsql stable security definer
    set search_path to ''
    as $$
begin
    if not exists (select 1 from app.account()) then
        return jsonb_build_object('ready', false);
    end if;
    if not app.is_super_admin() then
        return jsonb_build_object('ready', true, 'allowed', false);
    end if;

    return jsonb_build_object(
        'ready', true,
        'allowed', true,
        'generated_at', now(),
        'totals', (
            select jsonb_build_object(
                'orgs', (select count(*) from public.orgs),
                'people', (select count(distinct user_id) from public.members where user_id is not null),
                'invited', (select count(*) from public.members where user_id is null),
                'spaces', (select count(*) from public.spaces),
                'links', (select count(*) from public.links where status = 'approved' and kind = 'link'),
                'files', (select count(*) from public.links where status = 'approved' and kind = 'file'),
                'waiting', (select count(*) from public.links where status = 'pending'),
                'file_bytes', (select coalesce(sum(file_size), 0) from public.links where file_key is not null),
                'orgs_30d', (select count(*) from public.orgs where created_at > now() - interval '30 days'),
                'people_30d', (select count(distinct user_id) from public.members where joined_at > now() - interval '30 days'),
                'links_30d', (select count(*) from public.links where status = 'approved' and created_at > now() - interval '30 days')
            )
        ),
        -- One row per day for the last 30, oldest first.
        'days', (
            select jsonb_agg(jsonb_build_object(
                'day', d::date,
                'orgs', (select count(*) from public.orgs o where o.created_at::date = d::date),
                'people', (select count(*) from public.members m where m.joined_at::date = d::date),
                'links', (select count(*) from public.links l where l.created_at::date = d::date)
            ) order by d)
            from generate_series(current_date - 29, current_date, interval '1 day') d
        ),
        'orgs', (
            select coalesce(jsonb_agg(row order by row->>'name'), '[]'::jsonb)
            from (
                select jsonb_build_object(
                    'id', o.id,
                    'slug', o.slug,
                    'name', o.name,
                    'created_at', o.created_at,
                    'owner', (select lower(u.email) from neon_auth."user" u where u.id = o.created_by),
                    'people', (select count(*) from public.members m where m.org_id = o.id and m.user_id is not null),
                    'invited', (select count(*) from public.members m where m.org_id = o.id and m.user_id is null),
                    'spaces', (select count(*) from public.spaces s where s.org_id = o.id),
                    'links', (select count(*) from public.links l where l.org_id = o.id and l.status = 'approved' and l.kind = 'link'),
                    'files', (select count(*) from public.links l where l.org_id = o.id and l.status = 'approved' and l.kind = 'file'),
                    'waiting', (select count(*) from public.links l where l.org_id = o.id and l.status = 'pending'),
                    'file_bytes', (select coalesce(sum(l.file_size), 0) from public.links l where l.org_id = o.id and l.file_key is not null),
                    'last_active', greatest(
                        o.created_at,
                        (select max(l.created_at) from public.links l where l.org_id = o.id),
                        (select max(m.joined_at) from public.members m where m.org_id = o.id)
                    )
                ) as row
                from public.orgs o
            ) rows
        ),
        -- The spaces that hold the most, largest first.
        'spaces', (
            select coalesce(jsonb_agg(row order by (row->>'file_bytes')::bigint desc), '[]'::jsonb)
            from (
                select jsonb_build_object('org', o.name, 'space', s.name, 'files', count(l.id), 'file_bytes', coalesce(sum(l.file_size), 0)) as row
                from public.spaces s
                join public.orgs o on o.id = s.org_id
                join public.links l on l.space_id = s.id and l.file_key is not null
                group by o.name, s.name
                order by coalesce(sum(l.file_size), 0) desc
                limit 10
            ) rows
        )
    );
end
$$;

revoke all on function public.back_office_report() from public;
grant execute on function public.back_office_report() to authenticated;
