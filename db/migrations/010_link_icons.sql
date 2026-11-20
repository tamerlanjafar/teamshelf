-- The address of a link's icon, found when the link is saved (the page is read by the icon
-- function on the server, see netlify/functions/icon.mjs). Null: not found, the app then tries the
-- usual places itself.

alter table public.links add column icon_url text check (icon_url ~* '^https?://[^\s]+$' and length(icon_url) <= 2000);

grant insert (icon_url), update (icon_url) on public.links to authenticated;
