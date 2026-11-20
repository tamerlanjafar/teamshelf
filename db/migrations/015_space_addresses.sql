-- A space's board is at /<org>/<space>. The organization's own pages sit at the same level
-- (/<org>/requests, /<org>/settings, /<org>/team), so no space can have those addresses.

alter table public.spaces add constraint spaces_slug_reserved check (slug not in ('requests', 'settings', 'team', 'none'));
