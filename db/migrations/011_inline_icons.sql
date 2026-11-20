-- An https site may not show an image from an http address, so the icon of such a link is saved
-- as a small copy of the image itself (a `data:image/…;base64,…` address) instead of its address.

alter table public.links drop constraint links_icon_url_check;
alter table public.links add constraint links_icon_url_check check (
  (icon_url ~* '^https?://[^\s]+$' and length(icon_url) <= 2000)
  or (icon_url ~* '^data:image/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$' and length(icon_url) <= 70000)
);
