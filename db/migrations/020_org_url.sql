-- An organization's admins can change its address (/<slug>). The format, the reserved words and
-- uniqueness are checked by the constraints orgs already has. Old links stop working.
--
-- Each organization's sessions are kept under its address (/api/auth/<slug>, see
-- netlify/lib/auth-proxy.mjs); the app moves the session of the admin who made the change.
grant update (slug) on public.orgs to authenticated;
