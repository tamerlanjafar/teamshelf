-- "/signup" (creating an organization) and "/open" (opening the app from the front page) are now
-- pages of the app, so no organization can have those addresses.

alter table public.orgs drop constraint orgs_slug_check;
alter table public.orgs add constraint orgs_slug_check check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
    and length(slug) >= 2
    and slug not in ('login', 'signup', 'open', 'new', 'join', 'assets', 'api', 'settings', 'organizations', 'file')
);
