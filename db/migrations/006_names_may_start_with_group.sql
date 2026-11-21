-- A link's name may start with its group's name ("Project Board" in the group Project). The rule
-- that refused it ("Drop “Project” from the front") is gone, here and in the form
-- (src/features/links/name-rules.ts). The other rules stay. `group_name` is still passed in by
-- the trigger (app.check_link_name) and is no longer looked at.

create or replace function app.link_name_error(title text, group_name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
    name text := title;
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
