-- Teamshelf's database, as one starting point: every table, function, trigger, row-level security
-- policy and grant in the `public` and `app` schemas, as they stood after the first 22 migrations
-- (squashed on 2026-11-21). Made with `pg_dump --schema-only --no-owner --schema=public --schema=app`.
--
-- It expects what Neon provides: the `authenticated` and `anonymous` roles, and the Data API's
-- pg_session_jwt extension (`auth.uid()`), which it creates if missing. It holds no data: the emails that may create organizations go in
-- public.org_creators (see README.md, "Who can create organizations").
--
-- New changes go in new files after this one (001_..., 002_...), applied with `pnpm db:migrate`.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.7 (84da7d8)
-- Dumped by pg_dump version 19.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- pg_session_jwt gives auth.uid() and auth.session() to the policies below. Neon installs it with
-- the Data API; this only creates it where it is missing.
--

CREATE EXTENSION IF NOT EXISTS pg_session_jwt WITH SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.account() RETURNS TABLE(id uuid, email text, name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select u.id, lower(u.email), coalesce(u.name, '')
    from neon_auth."user" u
    where u.id = auth.uid() and u."emailVerified"
$$;


--
-- Name: add_default_spaces(uuid, uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.add_default_spaces(org uuid, creator uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: can_create_org(text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.can_create_org(email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select exists (select 1 from public.org_creators c where c.email = lower(can_create_org.email))
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    allowed_domains text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT orgs_allowed_domains_check CHECK ((array_to_string(allowed_domains, ','::text) ~ '^([a-z0-9-]+(\.[a-z0-9-]+)+(,|$))*$'::text)),
    CONSTRAINT orgs_domains_count CHECK ((cardinality(allowed_domains) <= 20)),
    CONSTRAINT orgs_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 60))),
    CONSTRAINT orgs_slug_check CHECK (((slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'::text) AND (length(slug) >= 2) AND (slug <> ALL (ARRAY['login'::text, 'signup'::text, 'open'::text, 'new'::text, 'join'::text, 'assets'::text, 'api'::text, 'settings'::text, 'organizations'::text, 'file'::text]))))
);


--
-- Name: can_join(public.orgs, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.can_join(org public.orgs, email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select split_part(email, '@', 2) = any (org.allowed_domains)
        and not exists (select 1 from public.removed_members r where r.org_id = org.id and r.email = can_join.email)
$$;


--
-- Name: can_see_space(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.can_see_space(space uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select coalesce((
        select app.is_member(s.org_id) and (s.visibility = 'org' or app.space_role(s.id) is not null)
        from public.spaces s where s.id = space
    ), false)
$$;


--
-- Name: check_link_name(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.check_link_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
    problem text;
begin
    if tg_op = 'UPDATE' and new.title is not distinct from old.title then
        return new;
    end if;
    problem := app.link_name_error(
        new.title,
        coalesce((select g.name from public.groups g where g.id = new.group_id), new.proposed_group)
    );
    if problem is not null then
        raise exception '%', problem using errcode = 'P0001', hint = 'link-name';
    end if;
    return new;
end
$$;


--
-- Name: claim_invitations(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.claim_invitations(only_org uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: forget_removed_member(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.forget_removed_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if new.approved then
        delete from public.removed_members where org_id = new.org_id and email = new.email;
    end if;
    return new;
end
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_admin(org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select coalesce(app.member_role(org) = 'admin', false)
$$;


--
-- Name: is_member(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_member(org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select app.member_id(org) is not null
$$;


--
-- Name: is_space_admin(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.is_space_admin(space uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select coalesce(app.space_role(space) = 'admin' and app.is_member(app.space_org(space)), false)
$$;


--
-- Name: keep_a_space_admin(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.keep_a_space_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: keep_an_org_admin(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.keep_an_org_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: link_name_error(text, text); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.link_name_error(title text, group_name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
    name text := title;
    rest text;
    word text;
    first_word text;
begin
    if name is null or name = '' then return 'Give the link a name.'; end if;
    if name <> btrim(name) then return 'Remove the spaces at the start and end of the name.'; end if;
    if length(name) < 2 then return 'A name needs at least 2 characters.'; end if;
    if length(name) > 60 then return format('Keep the name to 60 characters. This one has %s.', length(name)); end if;
    if name ~* '://|^www\.' or name ~ '^[[:alnum:]_-]+(\.[[:alnum:]_-]+)+(/\S*)?$' then
        return 'This is an address, not a name. Write what the link opens.';
    end if;

    if group_name is not null and btrim(group_name) <> '' and lower(name) like lower(btrim(group_name)) || '%' then
        rest := substr(name, length(btrim(group_name)) + 1);
        if rest ~ '^(\s+[-–—|:,]?|[–—|:,])\s*\S' then
            return format('Drop “%s” from the front. The card already shows the group.', btrim(group_name));
        end if;
    end if;

    if name ~ '[–—|:]' or name ~ '\s-|-\s' then return 'Put extra detail in brackets, like “Payments API (v2)”.'; end if;
    if name ~ '_' then return 'Remove “_”. Use spaces between words.'; end if;
    if name !~ '^[[:alpha:][:digit:] .&''()/+#,-]+$' then return 'Names use letters, digits, spaces and . , & '' ( ) / + # -'; end if;
    if name ~ '\s\s' then return 'Use one space between words.'; end if;
    if name ~ '[.,/&+-]$' then return 'Remove the punctuation at the end.'; end if;
    if name !~ '^[[:alpha:][:digit:](]' then return 'Start the name with a letter or a digit.'; end if;
    if length(name) - length(replace(name, '(', '')) <> length(name) - length(replace(name, ')', '')) then
        return 'Close the bracket, or remove it.';
    end if;
    if lower(name) in ('link', 'links', 'website', 'site', 'url', 'page', 'here', 'home', 'new link', 'untitled', 'click here', 'open', 'app') then
        return 'The name doesn''t say what the link opens. Name the tool or the page.';
    end if;

    first_word := split_part(regexp_replace(name, '^\(', ''), ' ', 1);
    if first_word ~ '^[[:lower:]]' and first_word !~ '[[:upper:]]' then return 'Start with a capital letter.'; end if;
    foreach word in array regexp_split_to_array(name, '[\s()/-]+') loop
        if word ~ '^[[:upper:]]{6,}$' then
            return format('Write “%s” with small letters. Capitals are for abbreviations of up to 5 letters.', word);
        end if;
    end loop;
    return null;
end
$_$;


--
-- Name: link_org(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.link_org(link uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select org_id from public.links where id = link
$$;


--
-- Name: link_space(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.link_space(link uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select space_id from public.links where id = link
$$;


--
-- Name: member_id(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.member_id(org uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if auth.uid() is null then
        raise exception 'Your account isn''t ready yet. Try again in a moment.' using errcode = '28000';
    end if;
    return (select id from public.members where org_id = org and user_id = auth.uid());
end
$$;


--
-- Name: member_role(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.member_role(org uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if auth.uid() is null then
        raise exception 'Your account isn''t ready yet. Try again in a moment.' using errcode = '28000';
    end if;
    return (select role from public.members where org_id = org and user_id = auth.uid());
end
$$;


--
-- Name: only_admins_open_spaces(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.only_admins_open_spaces() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if new.visibility = 'org' and old.visibility <> 'org' and auth.uid() is not null and not app.is_admin(new.org_id) then
        raise exception 'Only admins of the organization can open a space to everyone in it.' using errcode = '42501';
    end if;
    return new;
end
$$;


--
-- Name: remember_removed_member(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.remember_removed_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    -- Not when the whole organization is being deleted.
    if old.approved and exists (select 1 from public.orgs where id = old.org_id) then
        insert into public.removed_members (org_id, email) values (old.org_id, old.email)
        on conflict (org_id, email) do update set removed_at = now();
    end if;
    return old;
end
$$;


--
-- Name: space_org(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.space_org(space uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select org_id from public.spaces where id = space
$$;


--
-- Name: space_role(uuid); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.space_role(space uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select sm.role
    from public.space_members sm join public.members m on m.id = sm.member_id
    where sm.space_id = space and m.user_id = auth.uid()
$$;


--
-- Name: stamp_inviter(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.stamp_inviter() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if auth.uid() is not null then
        new.invited_by := app.member_id(new.org_id);
    end if;
    return new;
end
$$;


--
-- Name: stamp_link_author(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.stamp_link_author() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if auth.uid() is not null then
        new.created_by := app.member_id(new.org_id);
    end if;
    return new;
end
$$;


--
-- Name: trash_file(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.trash_file() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if old.file_key is not null and (tg_op = 'DELETE' or new.file_key is distinct from old.file_key) then
        insert into public.file_trash (file_key) values (old.file_key) on conflict do nothing;
    end if;
    return null;
end
$$;


--
-- Name: can_add_to_space(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_add_to_space(space uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select app.can_see_space(space)
$$;


--
-- Name: create_org(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_org(org_name text, org_slug text) RETURNS public.orgs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    logo text DEFAULT 'grid'::text NOT NULL,
    color text DEFAULT 'indigo'::text NOT NULL,
    visibility text DEFAULT 'org'::text NOT NULL,
    "position" integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    card_sizes jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT spaces_card_sizes_check CHECK (((jsonb_typeof(card_sizes) = 'object'::text) AND (pg_column_size(card_sizes) <= 50000))),
    CONSTRAINT spaces_layout_check CHECK (((jsonb_typeof(layout) = 'array'::text) AND (pg_column_size(layout) <= 200000))),
    CONSTRAINT spaces_logo_check CHECK (((logo ~ '^[a-z0-9-]{1,30}$'::text) OR ((logo ~* '^data:image/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$'::text) AND (length(logo) <= 140000)))),
    CONSTRAINT spaces_name_check CHECK (((name = TRIM(BOTH FROM name)) AND ((length(name) >= 1) AND (length(name) <= 40)))),
    CONSTRAINT spaces_slug_check CHECK ((slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'::text)),
    CONSTRAINT spaces_slug_reserved CHECK ((slug <> ALL (ARRAY['requests'::text, 'settings'::text, 'team'::text, 'none'::text]))),
    CONSTRAINT spaces_visibility_check CHECK ((visibility = ANY (ARRAY['org'::text, 'private'::text])))
);


--
-- Name: create_space(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_space(org uuid, space_name text, space_slug text, space_logo text DEFAULT 'grid'::text, space_color text DEFAULT 'indigo'::text) RETURNS public.spaces
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: invite_to_space(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_to_space(space uuid, invitee_email text, invitee_role text DEFAULT 'member'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    user_id uuid,
    invited_by uuid,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    joined_at timestamp with time zone,
    org_id uuid NOT NULL,
    approved boolean DEFAULT true NOT NULL,
    CONSTRAINT members_email_shape CHECK (((email = lower(email)) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
    CONSTRAINT members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: join_org(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_org(org_slug text) RETURNS public.members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: my_orgs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_orgs() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
    account record;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('ready', false);
    end if;

    perform app.claim_invitations();

    return jsonb_build_object(
        'ready', true,
        'orgs', (
            select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'role', m.role) order by o.name), '[]'::jsonb)
            from public.members m join public.orgs o on o.id = m.org_id
            where m.user_id = account.id
        ),
        'joinable', (
            select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name) order by o.name), '[]'::jsonb)
            from public.orgs o
            where app.can_join(o, account.email)
                and not exists (select 1 from public.members m where m.org_id = o.id and m.user_id = account.id)
        ),
        'can_create', app.can_create_org(account.email)
    );
end
$$;


--
-- Name: open_org(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_org(org_slug text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
    account record;
    org public.orgs;
    member public.members;
begin
    select * into account from app.account();
    if account.id is null then
        return jsonb_build_object('ready', false);
    end if;

    select * into org from public.orgs where slug = lower(org_slug);
    if org.id is null then
        return jsonb_build_object('ready', true, 'access', null);
    end if;

    perform app.claim_invitations(org.id);
    select * into member from public.members where org_id = org.id and user_id = account.id;

    if member.id is not null then
        return jsonb_build_object('ready', true, 'access', jsonb_build_object('org', to_jsonb(org), 'member', to_jsonb(member), 'can_join', false));
    end if;
    if app.can_join(org, account.email) then
        return jsonb_build_object('ready', true, 'access', jsonb_build_object('org', jsonb_build_object('slug', org.slug, 'name', org.name), 'member', null, 'can_join', true));
    end if;
    return jsonb_build_object('ready', true, 'access', null);
end
$$;


--
-- Name: set_group_order(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_group_order(space uuid, ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if not app.is_space_admin(space) then
        raise exception 'Only the space''s admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.groups g set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where g.id = listed.id and g.space_id = space;
end
$$;


--
-- Name: set_link_order(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_link_order(group_id uuid, ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
    space uuid;
begin
    select g.space_id into space from public.groups g where g.id = set_link_order.group_id;
    if space is null or not app.is_space_admin(space) then
        raise exception 'Only the space''s admins can change the order for everyone.' using errcode = '42501';
    end if;
    update public.links l set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where l.id = listed.id and l.group_id = set_link_order.group_id;
end
$$;


--
-- Name: set_space_order(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_space_order(org uuid, ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
    if not app.is_admin(org) then
        raise exception 'Only admins of the organization can change the order of spaces.' using errcode = '42501';
    end if;
    update public.spaces s set position = listed.place
    from unnest(ids) with ordinality as listed (id, place)
    where s.id = listed.id and s.org_id = org;
end
$$;


--
-- Name: file_trash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_trash (
    file_key text NOT NULL,
    trashed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'graphite'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    "position" integer,
    space_id uuid NOT NULL,
    CONSTRAINT groups_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 60)))
);


--
-- Name: link_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_access (
    link_id uuid NOT NULL,
    member_id uuid NOT NULL
);


--
-- Name: links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    proposed_group text,
    title text NOT NULL,
    url text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    visibility text DEFAULT 'everyone'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    review_note text DEFAULT ''::text NOT NULL,
    org_id uuid NOT NULL,
    "position" integer,
    icon_url text,
    space_id uuid NOT NULL,
    kind text DEFAULT 'link'::text NOT NULL,
    file_key text,
    file_name text,
    file_size bigint,
    file_type text,
    CONSTRAINT links_approved_has_group CHECK (((status <> 'approved'::text) OR (group_id IS NOT NULL))),
    CONSTRAINT links_file_key_check CHECK ((length(file_key) <= 400)),
    CONSTRAINT links_file_name_check CHECK (((length(file_name) >= 1) AND (length(file_name) <= 200))),
    CONSTRAINT links_file_shape CHECK ((((kind = 'link'::text) AND (file_key IS NULL)) OR ((kind = 'file'::text) AND (file_key IS NOT NULL) AND (file_name IS NOT NULL) AND (file_size IS NOT NULL) AND (file_key ~~ ((((org_id)::text || '/'::text) || (space_id)::text) || '/%'::text))))),
    CONSTRAINT links_file_size_check CHECK (((file_size >= 0) AND (file_size <= 26214400))),
    CONSTRAINT links_file_type_check CHECK ((length(file_type) <= 120)),
    CONSTRAINT links_has_group CHECK (((group_id IS NOT NULL) OR (proposed_group IS NOT NULL))),
    CONSTRAINT links_icon_url_check CHECK ((((icon_url ~* '^https?://[^\s]+$'::text) AND (length(icon_url) <= 2000)) OR ((icon_url ~* '^data:image/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$'::text) AND (length(icon_url) <= 70000)))),
    CONSTRAINT links_kind_check CHECK ((kind = ANY (ARRAY['link'::text, 'file'::text]))),
    CONSTRAINT links_proposed_group_check CHECK (((length(TRIM(BOTH FROM proposed_group)) >= 1) AND (length(TRIM(BOTH FROM proposed_group)) <= 60))),
    CONSTRAINT links_review_note_check CHECK ((length(review_note) <= 300)),
    CONSTRAINT links_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT links_title_check CHECK (((length(title) >= 1) AND (length(title) <= 80))),
    CONSTRAINT links_url_check CHECK (((url ~* '^https?://[^\s]+$'::text) AND (length(url) <= 2000))),
    CONSTRAINT links_visibility_check CHECK ((visibility = ANY (ARRAY['everyone'::text, 'admins'::text, 'members'::text])))
);


--
-- Name: member_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_prefs (
    member_id uuid NOT NULL,
    group_order uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    link_order jsonb DEFAULT '{}'::jsonb NOT NULL,
    hidden_groups uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    hidden_links uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    recent_links jsonb DEFAULT '{}'::jsonb NOT NULL,
    card_sizes jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT member_prefs_card_sizes_check CHECK (((jsonb_typeof(card_sizes) = 'object'::text) AND (pg_column_size(card_sizes) <= 200000))),
    CONSTRAINT member_prefs_group_layout_check CHECK (((jsonb_typeof(group_layout) = 'object'::text) AND (pg_column_size(group_layout) <= 500000))),
    CONSTRAINT member_prefs_recent_links_check CHECK (((jsonb_typeof(recent_links) = 'object'::text) AND (pg_column_size(recent_links) <= 100000))),
    CONSTRAINT member_prefs_size CHECK (((cardinality(group_order) <= 2000) AND (cardinality(hidden_groups) <= 2000) AND (cardinality(hidden_links) <= 20000) AND (pg_column_size(link_order) <= 1000000)))
);


--
-- Name: org_creators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_creators (
    email text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_creators_email_check CHECK ((email = lower(email)))
);


--
-- Name: removed_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.removed_members (
    org_id uuid NOT NULL,
    email text NOT NULL,
    removed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: space_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_members (
    space_id uuid NOT NULL,
    member_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT space_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: file_trash file_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_trash
    ADD CONSTRAINT file_trash_pkey PRIMARY KEY (file_key);


--
-- Name: groups groups_id_org_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_id_org_key UNIQUE (id, org_id);


--
-- Name: groups groups_id_space_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_id_space_key UNIQUE (id, space_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: link_access link_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_access
    ADD CONSTRAINT link_access_pkey PRIMARY KEY (link_id, member_id);


--
-- Name: links links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_pkey PRIMARY KEY (id);


--
-- Name: member_prefs member_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_prefs
    ADD CONSTRAINT member_prefs_pkey PRIMARY KEY (member_id);


--
-- Name: members members_org_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_org_email_key UNIQUE (org_id, email);


--
-- Name: members members_org_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_org_user_key UNIQUE (org_id, user_id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: org_creators org_creators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_creators
    ADD CONSTRAINT org_creators_pkey PRIMARY KEY (email);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: orgs orgs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_slug_key UNIQUE (slug);


--
-- Name: removed_members removed_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.removed_members
    ADD CONSTRAINT removed_members_pkey PRIMARY KEY (org_id, email);


--
-- Name: space_members space_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_pkey PRIMARY KEY (space_id, member_id);


--
-- Name: spaces spaces_id_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_id_org_id_key UNIQUE (id, org_id);


--
-- Name: spaces spaces_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: groups_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX groups_name_unique ON public.groups USING btree (space_id, lower(name));


--
-- Name: link_access_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX link_access_member ON public.link_access USING btree (member_id);


--
-- Name: links_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX links_group ON public.links USING btree (group_id);


--
-- Name: links_group_title; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX links_group_title ON public.links USING btree (group_id, lower(title)) WHERE (status = 'approved'::text);


--
-- Name: links_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX links_org ON public.links USING btree (org_id);


--
-- Name: links_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX links_space ON public.links USING btree (space_id);


--
-- Name: links_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX links_status ON public.links USING btree (status);


--
-- Name: members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX members_user ON public.members USING btree (user_id);


--
-- Name: space_members_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX space_members_member ON public.space_members USING btree (member_id);


--
-- Name: spaces_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spaces_name_unique ON public.spaces USING btree (org_id, lower(name));


--
-- Name: links links_check_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER links_check_name BEFORE INSERT OR UPDATE OF title ON public.links FOR EACH ROW EXECUTE FUNCTION app.check_link_name();


--
-- Name: links links_stamp_author; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER links_stamp_author BEFORE INSERT ON public.links FOR EACH ROW EXECUTE FUNCTION app.stamp_link_author();


--
-- Name: links links_trash_file; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER links_trash_file AFTER DELETE OR UPDATE OF file_key ON public.links FOR EACH ROW EXECUTE FUNCTION app.trash_file();


--
-- Name: members members_forget_removed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER members_forget_removed AFTER INSERT OR UPDATE OF approved ON public.members FOR EACH ROW EXECUTE FUNCTION app.forget_removed_member();


--
-- Name: members members_keep_an_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER members_keep_an_admin BEFORE DELETE OR UPDATE OF role ON public.members FOR EACH ROW EXECUTE FUNCTION app.keep_an_org_admin();


--
-- Name: members members_remember_removed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER members_remember_removed AFTER DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION app.remember_removed_member();


--
-- Name: members members_stamp_inviter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER members_stamp_inviter BEFORE INSERT ON public.members FOR EACH ROW EXECUTE FUNCTION app.stamp_inviter();


--
-- Name: space_members space_members_keep_an_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER space_members_keep_an_admin BEFORE DELETE OR UPDATE OF role ON public.space_members FOR EACH ROW EXECUTE FUNCTION app.keep_a_space_admin();


--
-- Name: spaces spaces_only_admins_open; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER spaces_only_admins_open BEFORE UPDATE OF visibility ON public.spaces FOR EACH ROW EXECUTE FUNCTION app.only_admins_open_spaces();


--
-- Name: groups groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: groups groups_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_space_fkey FOREIGN KEY (space_id, org_id) REFERENCES public.spaces(id, org_id) ON DELETE CASCADE;


--
-- Name: link_access link_access_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_access
    ADD CONSTRAINT link_access_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: link_access link_access_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_access
    ADD CONSTRAINT link_access_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: links links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: links links_group_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_group_fkey FOREIGN KEY (group_id, org_id) REFERENCES public.groups(id, org_id) ON DELETE CASCADE;


--
-- Name: links links_group_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_group_space_fkey FOREIGN KEY (group_id, space_id) REFERENCES public.groups(id, space_id) ON DELETE CASCADE;


--
-- Name: links links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: links links_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_space_fkey FOREIGN KEY (space_id, org_id) REFERENCES public.spaces(id, org_id) ON DELETE CASCADE;


--
-- Name: member_prefs member_prefs_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_prefs
    ADD CONSTRAINT member_prefs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: members members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: members members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;


--
-- Name: removed_members removed_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.removed_members
    ADD CONSTRAINT removed_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: spaces spaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: file_trash; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_trash ENABLE ROW LEVEL SECURITY;

--
-- Name: file_trash file_trash_cleanup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY file_trash_cleanup ON public.file_trash TO teamshelf_files USING (true);


--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: groups groups_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_read ON public.groups FOR SELECT TO authenticated USING (app.can_see_space(space_id));


--
-- Name: groups groups_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_write ON public.groups TO authenticated USING (app.is_space_admin(space_id)) WITH CHECK (app.is_space_admin(space_id));


--
-- Name: link_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_access ENABLE ROW LEVEL SECURITY;

--
-- Name: link_access link_access_grant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY link_access_grant ON public.link_access FOR INSERT TO authenticated WITH CHECK ((app.is_space_admin(app.link_space(link_id)) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = link_access.member_id) AND (m.org_id = app.link_org(link_access.link_id)))))));


--
-- Name: link_access link_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY link_access_read ON public.link_access FOR SELECT TO authenticated USING (((member_id = app.member_id(app.link_org(link_id))) OR app.is_space_admin(app.link_space(link_id))));


--
-- Name: link_access link_access_revoke; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY link_access_revoke ON public.link_access FOR DELETE TO authenticated USING (app.is_space_admin(app.link_space(link_id)));


--
-- Name: links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

--
-- Name: links links_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY links_edit ON public.links FOR UPDATE TO authenticated USING (app.is_space_admin(space_id)) WITH CHECK (app.is_space_admin(space_id));


--
-- Name: links links_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY links_read ON public.links FOR SELECT TO authenticated USING ((app.is_space_admin(space_id) OR (created_by = app.member_id(org_id)) OR ((status = 'approved'::text) AND app.can_see_space(space_id) AND ((visibility = 'everyone'::text) OR ((visibility = 'members'::text) AND (EXISTS ( SELECT 1
   FROM public.link_access a
  WHERE ((a.link_id = links.id) AND (a.member_id = app.member_id(links.org_id))))))))));


--
-- Name: links links_remove; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY links_remove ON public.links FOR DELETE TO authenticated USING ((app.is_space_admin(space_id) OR ((created_by = app.member_id(org_id)) AND (status <> 'approved'::text))));


--
-- Name: links links_suggest; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY links_suggest ON public.links FOR INSERT TO authenticated WITH CHECK (((created_by = app.member_id(org_id)) AND app.can_see_space(space_id) AND (app.is_space_admin(space_id) OR ((status = 'pending'::text) AND (visibility = 'everyone'::text) AND (reviewed_at IS NULL)))));


--
-- Name: member_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: member_prefs member_prefs_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_prefs_own ON public.member_prefs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = member_prefs.member_id) AND (m.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = member_prefs.member_id) AND (m.user_id = auth.uid())))));


--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: members members_change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_change ON public.members FOR UPDATE TO authenticated USING (app.is_admin(org_id)) WITH CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])));


--
-- Name: members members_invite; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_invite ON public.members FOR INSERT TO authenticated WITH CHECK ((app.is_admin(org_id) AND (role = ANY (ARRAY['admin'::text, 'member'::text]))));


--
-- Name: members members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_read ON public.members FOR SELECT TO authenticated USING (app.is_member(org_id));


--
-- Name: members members_remove; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_remove ON public.members FOR DELETE TO authenticated USING (app.is_admin(org_id));


--
-- Name: org_creators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_creators ENABLE ROW LEVEL SECURITY;

--
-- Name: orgs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: orgs orgs_change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orgs_change ON public.orgs FOR UPDATE TO authenticated USING (app.is_admin(id)) WITH CHECK (app.is_admin(id));


--
-- Name: orgs orgs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orgs_read ON public.orgs FOR SELECT TO authenticated USING (app.is_member(id));


--
-- Name: removed_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.removed_members ENABLE ROW LEVEL SECURITY;

--
-- Name: space_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

--
-- Name: space_members space_members_add; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY space_members_add ON public.space_members FOR INSERT TO authenticated WITH CHECK ((app.is_space_admin(space_id) AND (EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = space_members.member_id) AND (m.org_id = app.space_org(space_members.space_id)))))));


--
-- Name: space_members space_members_change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY space_members_change ON public.space_members FOR UPDATE TO authenticated USING (app.is_space_admin(space_id)) WITH CHECK (app.is_space_admin(space_id));


--
-- Name: space_members space_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY space_members_read ON public.space_members FOR SELECT TO authenticated USING (app.can_see_space(space_id));


--
-- Name: space_members space_members_remove; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY space_members_remove ON public.space_members FOR DELETE TO authenticated USING (app.is_space_admin(space_id));


--
-- Name: spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: spaces spaces_change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_change ON public.spaces FOR UPDATE TO authenticated USING (app.is_space_admin(id)) WITH CHECK (app.is_space_admin(id));


--
-- Name: spaces spaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_delete ON public.spaces FOR DELETE TO authenticated USING (app.is_space_admin(id));


--
-- Name: spaces spaces_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_read ON public.spaces FOR SELECT TO authenticated USING (app.can_see_space(id));


--
-- Name: SCHEMA app; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA app TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO teamshelf_files;


--
-- Name: FUNCTION account(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.account() FROM PUBLIC;


--
-- Name: FUNCTION add_default_spaces(org uuid, creator uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.add_default_spaces(org uuid, creator uuid) FROM PUBLIC;


--
-- Name: FUNCTION can_create_org(email text); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.can_create_org(email text) FROM PUBLIC;


--
-- Name: TABLE orgs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.orgs TO authenticated;


--
-- Name: COLUMN orgs.slug; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(slug) ON TABLE public.orgs TO authenticated;


--
-- Name: COLUMN orgs.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.orgs TO authenticated;


--
-- Name: COLUMN orgs.allowed_domains; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(allowed_domains) ON TABLE public.orgs TO authenticated;


--
-- Name: FUNCTION can_join(org public.orgs, email text); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.can_join(org public.orgs, email text) FROM PUBLIC;


--
-- Name: FUNCTION can_see_space(space uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.can_see_space(space uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.can_see_space(space uuid) TO authenticated;


--
-- Name: FUNCTION check_link_name(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.check_link_name() FROM PUBLIC;


--
-- Name: FUNCTION claim_invitations(only_org uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.claim_invitations(only_org uuid) FROM PUBLIC;


--
-- Name: FUNCTION forget_removed_member(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.forget_removed_member() FROM PUBLIC;


--
-- Name: FUNCTION is_admin(org uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.is_admin(org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.is_admin(org uuid) TO authenticated;


--
-- Name: FUNCTION is_member(org uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.is_member(org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.is_member(org uuid) TO authenticated;


--
-- Name: FUNCTION is_space_admin(space uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.is_space_admin(space uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.is_space_admin(space uuid) TO authenticated;


--
-- Name: FUNCTION keep_a_space_admin(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.keep_a_space_admin() FROM PUBLIC;


--
-- Name: FUNCTION keep_an_org_admin(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.keep_an_org_admin() FROM PUBLIC;


--
-- Name: FUNCTION link_name_error(title text, group_name text); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.link_name_error(title text, group_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.link_name_error(title text, group_name text) TO authenticated;


--
-- Name: FUNCTION link_org(link uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.link_org(link uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.link_org(link uuid) TO authenticated;


--
-- Name: FUNCTION link_space(link uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.link_space(link uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.link_space(link uuid) TO authenticated;


--
-- Name: FUNCTION member_id(org uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.member_id(org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.member_id(org uuid) TO authenticated;


--
-- Name: FUNCTION member_role(org uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.member_role(org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.member_role(org uuid) TO authenticated;


--
-- Name: FUNCTION only_admins_open_spaces(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.only_admins_open_spaces() FROM PUBLIC;


--
-- Name: FUNCTION remember_removed_member(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.remember_removed_member() FROM PUBLIC;


--
-- Name: FUNCTION space_org(space uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.space_org(space uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.space_org(space uuid) TO authenticated;


--
-- Name: FUNCTION space_role(space uuid); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.space_role(space uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.space_role(space uuid) TO authenticated;


--
-- Name: FUNCTION stamp_inviter(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.stamp_inviter() FROM PUBLIC;


--
-- Name: FUNCTION stamp_link_author(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.stamp_link_author() FROM PUBLIC;


--
-- Name: FUNCTION trash_file(); Type: ACL; Schema: app; Owner: -
--

REVOKE ALL ON FUNCTION app.trash_file() FROM PUBLIC;


--
-- Name: FUNCTION can_add_to_space(space uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_add_to_space(space uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_add_to_space(space uuid) TO authenticated;


--
-- Name: FUNCTION create_org(org_name text, org_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_org(org_name text, org_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_org(org_name text, org_slug text) TO authenticated;


--
-- Name: TABLE spaces; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.logo; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(logo) ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.color; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(color) ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.visibility; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(visibility) ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.layout; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(layout) ON TABLE public.spaces TO authenticated;


--
-- Name: COLUMN spaces.card_sizes; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(card_sizes) ON TABLE public.spaces TO authenticated;


--
-- Name: FUNCTION create_space(org uuid, space_name text, space_slug text, space_logo text, space_color text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_space(org uuid, space_name text, space_slug text, space_logo text, space_color text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_space(org uuid, space_name text, space_slug text, space_logo text, space_color text) TO authenticated;


--
-- Name: FUNCTION invite_to_space(space uuid, invitee_email text, invitee_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.invite_to_space(space uuid, invitee_email text, invitee_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invite_to_space(space uuid, invitee_email text, invitee_role text) TO authenticated;


--
-- Name: TABLE members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.members TO authenticated;


--
-- Name: COLUMN members.email; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(email) ON TABLE public.members TO authenticated;


--
-- Name: COLUMN members.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name),UPDATE(name) ON TABLE public.members TO authenticated;


--
-- Name: COLUMN members.role; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(role),UPDATE(role) ON TABLE public.members TO authenticated;


--
-- Name: COLUMN members.org_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(org_id) ON TABLE public.members TO authenticated;


--
-- Name: COLUMN members.approved; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(approved) ON TABLE public.members TO authenticated;


--
-- Name: FUNCTION join_org(org_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_org(org_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_org(org_slug text) TO authenticated;


--
-- Name: FUNCTION my_orgs(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_orgs() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_orgs() TO authenticated;


--
-- Name: FUNCTION open_org(org_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_org(org_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_org(org_slug text) TO authenticated;


--
-- Name: FUNCTION set_group_order(space uuid, ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_group_order(space uuid, ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_group_order(space uuid, ids uuid[]) TO authenticated;


--
-- Name: FUNCTION set_link_order(group_id uuid, ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_link_order(group_id uuid, ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_link_order(group_id uuid, ids uuid[]) TO authenticated;


--
-- Name: FUNCTION set_space_order(org uuid, ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_space_order(org uuid, ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_space_order(org uuid, ids uuid[]) TO authenticated;


--
-- Name: TABLE file_trash; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.file_trash TO teamshelf_files;


--
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name),UPDATE(name) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.color; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(color),UPDATE(color) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.org_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(org_id) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.space_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(space_id) ON TABLE public.groups TO authenticated;


--
-- Name: TABLE link_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.link_access TO authenticated;


--
-- Name: TABLE links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.group_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(group_id),UPDATE(group_id) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.proposed_group; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(proposed_group),UPDATE(proposed_group) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.title; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(title),UPDATE(title) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.url; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(url),UPDATE(url) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.visibility; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(visibility),UPDATE(visibility) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.reviewed_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reviewed_at),UPDATE(reviewed_at) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.review_note; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(review_note) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.org_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(org_id) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.icon_url; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(icon_url),UPDATE(icon_url) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.space_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(space_id) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.file_key; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_key) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.file_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_name) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.file_size; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_size) ON TABLE public.links TO authenticated;


--
-- Name: COLUMN links.file_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(file_type) ON TABLE public.links TO authenticated;


--
-- Name: TABLE member_prefs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.member_prefs TO authenticated;


--
-- Name: TABLE space_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.space_members TO authenticated;


--
-- Name: COLUMN space_members.space_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(space_id) ON TABLE public.space_members TO authenticated;


--
-- Name: COLUMN space_members.member_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(member_id) ON TABLE public.space_members TO authenticated;


--
-- Name: COLUMN space_members.role; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(role),UPDATE(role) ON TABLE public.space_members TO authenticated;


--
-- PostgreSQL database dump complete
--


