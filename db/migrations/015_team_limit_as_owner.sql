-- The limit of 100 teams in 014_teams.sql ran as the person saving, who can't read the auth schema:
-- creating a team failed with "permission denied for schema auth" (limit_teams asks auth.uid()).
-- It runs as its owner now, like limit_groups and the folder checks (011): how many teams there
-- are doesn't depend on who is saving, and row-level security still decides who may save at all.

alter function app.limit_teams() security definer;
