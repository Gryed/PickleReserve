-- =========================================================
-- PHASE 4A
-- PUBLIC AVAILABILITY RPC
--
-- Purpose:
-- Replace public direct SELECT access to reservations
-- with a controlled RPC that exposes ONLY slot occupancy.
--
-- Exposed:
--   court_id
--   date
--   start_time
--   end_time
--   payment_status
--
-- NOT exposed:
--   user_id
--   guest_name
--   guest_phone
--   booking_reference
--   amount_due
--   payment_proof_url
--   payment_type
--   created_at
--   any other reservation fields
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_court_availability(
  p_court_id uuid,
  p_date date
)
RETURNS TABLE (
  court_id uuid,
  booking_date date,
  start_time time,
  end_time time,
  payment_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.court_id,
    r.date AS booking_date,
    r.start_time,
    r.end_time,
    r.payment_status
  FROM public.reservations r
  WHERE r.court_id = p_court_id
    AND r.date = p_date
    AND r.status = 'confirmed'
    AND r.payment_status IN ('pending', 'verified')
  ORDER BY r.start_time ASC;
$$;

-- Remove any existing broad/default execution.
REVOKE ALL ON FUNCTION public.get_public_court_availability(uuid, date)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_public_court_availability(uuid, date)
FROM anon;

REVOKE ALL ON FUNCTION public.get_public_court_availability(uuid, date)
FROM authenticated;

-- Public booking availability is intentionally readable.
GRANT EXECUTE ON FUNCTION public.get_public_court_availability(uuid, date)
TO anon;

GRANT EXECUTE ON FUNCTION public.get_public_court_availability(uuid, date)
TO authenticated;