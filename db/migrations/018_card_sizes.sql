-- Cards can be resized: a card's height (how much of its list shows before it scrolls), and the
-- width of the board's columns, which share the board's width.
--
-- A size is { "heights": { "<group id>": <px> }, "widths": [<share of column 1>, …] }. The widths
-- are saved for the number of columns they were made on.
--
-- spaces.card_sizes is the space's, set by its admins, for everyone. member_prefs.card_sizes is a
-- person's own, per space ({ "<space id>": { … } }): a card or the columns they resized themselves.
-- Everything else follows the space's.

alter table public.spaces add column card_sizes jsonb not null default '{}'
    check (jsonb_typeof(card_sizes) = 'object' and pg_column_size(card_sizes) <= 50000);
-- Who may change a space's row (its admins) is already decided by the policy spaces_change.
grant update (card_sizes) on public.spaces to authenticated;

alter table public.member_prefs add column card_sizes jsonb not null default '{}'
    check (jsonb_typeof(card_sizes) = 'object' and pg_column_size(card_sizes) <= 200000);
