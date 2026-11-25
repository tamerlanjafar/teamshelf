-- Which folders each person has closed, kept with their other preferences, so a folder they
-- closed stays closed on every device they sign in on. Folders are open otherwise: a new folder
-- is open for everyone. Only they see it.
--
-- Apply before the app that reads it is deployed: the app reads and saves all of member_prefs
-- in one request, and a column it doesn't find fails the whole request.

alter table public.member_prefs add column closed_folders uuid[] default '{}'::uuid[] not null;
alter table public.member_prefs add constraint member_prefs_closed_folders_size check (cardinality(closed_folders) <= 5000);
