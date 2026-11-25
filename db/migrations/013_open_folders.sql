-- Folders start closed, for everyone (a new one too). Which ones each person opened is kept with
-- their other preferences, so a folder they opened stays open on every device they sign in on.
-- Only they see it. This replaces closed_folders (012), which the app no longer reads; it stays
-- until the app that reads it is gone everywhere, then can be dropped.
--
-- Apply before the app that reads it is deployed: the app reads and saves all of member_prefs
-- in one request, and a column it doesn't find fails the whole request.

alter table public.member_prefs add column open_folders uuid[] default '{}'::uuid[] not null;
alter table public.member_prefs add constraint member_prefs_open_folders_size check (cardinality(open_folders) <= 5000);
