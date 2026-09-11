-- 002_grant_permissions.sql

grant select on courts to anon, authenticated;
grant insert, update, delete on courts to authenticated;

grant select on settings to anon, authenticated;
grant insert, update, delete on settings to authenticated;