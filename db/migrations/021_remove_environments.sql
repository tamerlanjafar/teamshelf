-- No more environments. A link is one link: "Customer portal - Prod" was one environment of a
-- thing that shared a line on its card with the others; now it is a link of its own, named
-- "Customer portal (Prod)". Spaces no longer list environments, and a name no longer has a
-- " - " part with a meaning of its own: extra detail goes in brackets.

-- 1. The rules a name follows, without environments (the same as src/features/links/name-rules.ts,
--    except the two that compare a name with the other links of its group).

create function app.link_name_error(title text, group_name text) returns text
language plpgsql immutable set search_path = '' as $$
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
$$;

create or replace function app.check_link_name() returns trigger
language plpgsql security definer set search_path = '' as $$
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

revoke all on function app.link_name_error(text, text) from public;
grant execute on function app.link_name_error(text, text) to authenticated;
drop function app.link_name_error(text, text, text[]);

-- 2. "Thing - Environment" becomes "Thing (Environment)". The old rules allowed " - " once, only
--    before the environment, so this is the one " - " in a name. Same length, so no name grows
--    past the limit.

--    Names saved before the rules existed are renamed as they are, without checking them again
--    (as when they were saved): the check would stop the whole migration at the first one.

alter table public.links disable trigger links_check_name;
update public.links
set title = regexp_replace(title, '^(.*\S) - (\S.*)$', '\1 (\2)')
where title like '% - %';
alter table public.links enable trigger links_check_name;

-- 3. Spaces no longer list environments.

alter table public.spaces drop column environments;
