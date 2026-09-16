-- ============================================================
-- PHASE 4C
-- Open Play Public RPC + Cancellation Cleanup
-- ============================================================

-- ============================================================
-- 1. PUBLIC OPEN PLAY SESSION LIST
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_open_play_sessions()
RETURNS TABLE (
  id uuid,
  session_reference text,
  title text,
  court_id uuid,
  court_name text,
  session_date date,
  start_time time,
  end_time time,
  price_per_player numeric,
  capacity integer,
  status text,
  description text,
  rules text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    s.session_reference,
    s.title,
    s.court_id,
    c.name AS court_name,
    s.session_date,
    s.start_time,
    s.end_time,
    s.price_per_player,
    s.capacity,
    s.status,
    s.description,
    s.rules,
    s.registration_opens_at,
    s.registration_closes_at,
    s.created_at,
    s.updated_at
  FROM public.open_play_sessions s
  INNER JOIN public.courts c
    ON c.id = s.court_id
  WHERE s.status = 'open'
  ORDER BY
    s.session_date ASC,
    s.start_time ASC;
$$;

REVOKE ALL
ON FUNCTION public.get_public_open_play_sessions()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.get_public_open_play_sessions()
FROM anon;

REVOKE ALL
ON FUNCTION public.get_public_open_play_sessions()
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.get_public_open_play_sessions()
TO anon;

GRANT EXECUTE
ON FUNCTION public.get_public_open_play_sessions()
TO authenticated;


-- ============================================================
-- 2. PUBLIC OPEN PLAY SESSION DETAILS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_open_play_session(
  p_session_id uuid
)
RETURNS TABLE (
  id uuid,
  session_reference text,
  title text,
  court_id uuid,
  court_name text,
  session_date date,
  start_time time,
  end_time time,
  price_per_player numeric,
  capacity integer,
  status text,
  description text,
  rules text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    s.session_reference,
    s.title,
    s.court_id,
    c.name AS court_name,
    s.session_date,
    s.start_time,
    s.end_time,
    s.price_per_player,
    s.capacity,
    s.status,
    s.description,
    s.rules,
    s.registration_opens_at,
    s.registration_closes_at,
    s.created_at,
    s.updated_at
  FROM public.open_play_sessions s
  INNER JOIN public.courts c
    ON c.id = s.court_id
  WHERE s.id = p_session_id
    AND s.status = 'open';
$$;

REVOKE ALL
ON FUNCTION public.get_public_open_play_session(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.get_public_open_play_session(uuid)
FROM anon;

REVOKE ALL
ON FUNCTION public.get_public_open_play_session(uuid)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.get_public_open_play_session(uuid)
TO anon;

GRANT EXECUTE
ON FUNCTION public.get_public_open_play_session(uuid)
TO authenticated;


-- ============================================================
-- 3. FIX ADMIN OPEN PLAY CANCELLATION
--    Cancel reservation blockers when session is cancelled.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_open_play_session(
  p_session_id uuid,
  p_cancellation_reason text DEFAULT NULL
)
RETURNS public.open_play_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.open_play_sessions;
  v_role text;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.open_play_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open Play session not found.';
  END IF;

  IF v_session.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION
      'Open Play session cannot be cancelled because it is already %.',
      v_session.status;
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_cancellation_reason, '')), '');

  UPDATE public.open_play_sessions
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = v_reason,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING *
  INTO v_session;

  -- Release the court blocker rows created during publishing.
  UPDATE public.reservations
  SET
    status = 'cancelled'
  WHERE open_play_session_id = p_session_id
    AND booking_kind = 'open_play_block'
    AND status = 'confirmed';

  -- Cancel active participants.
  UPDATE public.open_play_participants
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = v_reason,
    updated_at = now()
  WHERE session_id = p_session_id
    AND status IN ('held', 'pending', 'confirmed');

  RETURN v_session;
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_cancel_open_play_session(uuid, text)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.admin_cancel_open_play_session(uuid, text)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.admin_cancel_open_play_session(uuid, text)
TO authenticated;