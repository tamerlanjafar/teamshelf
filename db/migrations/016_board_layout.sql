-- A board is laid out in columns, and a card can be put in any column, at any place in it.
--
-- spaces.layout is the space's layout, arranged by its admins: a list of columns, each a list
-- of group ids, top to bottom. member_prefs.group_layout is a person's own layout per space
-- ({ "<space id>": [[…], […]] }), for when personal ordering is switched on.
-- Groups that aren't in a layout (new ones) go to the end of the shortest column.

alter table public.spaces add column layout jsonb not null default '[]'
    check (jsonb_typeof(layout) = 'array' and pg_column_size(layout) <= 200000);
grant update (layout) on public.spaces to authenticated;

alter table public.member_prefs add column group_layout jsonb not null default '{}'
    check (jsonb_typeof(group_layout) = 'object' and pg_column_size(group_layout) <= 500000);
