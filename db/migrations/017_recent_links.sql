-- The links a person opened most recently, per space, newest first, at most 10 each:
-- { "<space id>": ["<link id>", …] }. Shown when they click into the search box.

alter table public.member_prefs add column recent_links jsonb not null default '{}'
    check (jsonb_typeof(recent_links) = 'object' and pg_column_size(recent_links) <= 100000);
