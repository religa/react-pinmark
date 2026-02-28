-- Grant table access to anon and authenticated roles.
-- RLS policies alone are not enough — PostgREST requires the role to have
-- base table privileges before it evaluates policies.
-- Run this if you applied migrations 001–004 before this fix was added.
-- GRANTs are idempotent — safe to re-run on fresh deployments.

grant select, insert, update, delete on table rc_threads to anon, authenticated;
grant select, insert, update, delete on table rc_comments to anon, authenticated;
