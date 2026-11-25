-- The folder checks of 010_folders.sql ran as the person saving, who can't read the auth schema:
-- creating a folder failed with "permission denied for schema auth" (check_folder asks
-- auth.uid() for the limit of 500 folders). They run as their owner now, like limit_groups and
-- the other checks: what they read (folders, how many) doesn't depend on who is saving, and
-- row-level security still decides who may save at all.

alter function app.check_folder() security definer;
alter function app.check_link_folder() security definer;
