-- ============================================================
-- PHASE 4D — OPEN PLAY ADMIN SELECT PRIVILEGE
-- Migration: 044_phase4d_open_play_admin_select.sql
-- ============================================================

BEGIN;

GRANT SELECT
ON TABLE public.open_play_sessions
TO authenticated;

COMMIT;