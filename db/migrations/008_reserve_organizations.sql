-- "/organizations" is now a page of the app (the list of your organizations), so no
-- organization can have that address.

alter table public.orgs drop constraint orgs_slug_check;
alter table public.orgs add constraint orgs_slug_check check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
    and length(slug) >= 2
    and slug not in ('login', 'new', 'join', 'assets', 'api', 'settings', 'organizations')
);
