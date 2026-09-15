BEGIN;

-- =========================================================
-- PHASE 4A — SECURITY HARDENING
-- PickleReserve
--
-- Goals:
-- 1. Remove public direct SELECT access to reservations
-- 2. Remove unrestricted reservation UPDATE access
-- 3. Preserve public booking creation
-- 4. Preserve Find Booking through controlled RPCs
-- 5. Preserve customer/guest cancellation through secure RPC
-- 6. Restrict courts/operating hours/payment management to admins
-- 7. Harden payment verification/rejection RPCs
-- 8. Remove anonymous access to legacy reschedule RPCs
-- =========================================================


-- =========================================================
-- 1. RESERVATIONS — REMOVE PUBLIC SELECT
-- =========================================================

DROP POLICY IF EXISTS "Anyone can view reservations"
ON public.reservations;


-- =========================================================
-- 2. RESERVATIONS — CUSTOMER / ADMIN SELECT
-- =========================================================

DROP POLICY IF EXISTS "Customers can view own reservations"
ON public.reservations;

CREATE POLICY "Customers can view own reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);


-- =========================================================
-- 3. RESERVATIONS — REMOVE BROAD UPDATE
-- =========================================================

DROP POLICY IF EXISTS "Users, guests, and admins can update reservations"
ON public.reservations;

DROP POLICY IF EXISTS "Customers can update own reservations"
ON public.reservations;


-- =========================================================
-- 4. RESERVATIONS — ADMIN UPDATE
--
-- Admin UI still needs controlled direct reservation
-- management. Customers/guests do not receive UPDATE.
-- =========================================================

DROP POLICY IF EXISTS "Admins can update reservations"
ON public.reservations;

CREATE POLICY "Admins can update reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);


-- =========================================================
-- 5. RESERVATIONS — PUBLIC BOOKING INSERT
-- =========================================================

DROP POLICY IF EXISTS "Users can book with account or as guest"
ON public.reservations;

CREATE POLICY "Users can book with account or as guest"
ON public.reservations
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  OR (
    user_id IS NULL
    AND guest_name IS NOT NULL
    AND guest_phone IS NOT NULL
  )
);


-- =========================================================
-- 6. COURTS — KEEP PUBLIC READ
-- =========================================================

DROP POLICY IF EXISTS "Anyone can view courts"
ON public.courts;

CREATE POLICY "Anyone can view courts"
ON public.courts
FOR SELECT
TO public
USING (true);


-- =========================================================
-- 7. COURTS — ADMIN ONLY MANAGEMENT
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can manage courts"
ON public.courts;

DROP POLICY IF EXISTS "Admins can manage courts"
ON public.courts;

CREATE POLICY "Admins can manage courts"
ON public.courts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);


-- =========================================================
-- 8. OPERATING HOURS — KEEP PUBLIC READ
-- =========================================================

DROP POLICY IF EXISTS "Anyone can view operating hours"
ON public.operating_hours;

CREATE POLICY "Anyone can view operating hours"
ON public.operating_hours
FOR SELECT
TO public
USING (true);


-- =========================================================
-- 9. OPERATING HOURS — ADMIN ONLY MANAGEMENT
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can manage operating hours"
ON public.operating_hours;

DROP POLICY IF EXISTS "Admins can manage operating hours"
ON public.operating_hours;

CREATE POLICY "Admins can manage operating hours"
ON public.operating_hours
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);


-- =========================================================
-- 10. PAYMENTS — ADMIN ONLY MANAGEMENT
-- =========================================================

DROP POLICY IF EXISTS "Admins can manage payments"
ON public.payments;

CREATE POLICY "Admins can manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);


-- =========================================================
-- 11. LEGACY RESCHEDULE RPCs
-- Remove anonymous execution.
-- =========================================================

REVOKE EXECUTE
ON FUNCTION public.create_reschedule_request(
  text,
  date,
  uuid,
  time,
  time
)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.create_reschedule_request(
  text,
  date,
  uuid,
  time,
  time
)
FROM anon;


REVOKE EXECUTE
ON FUNCTION public.create_reschedule_request_multislot(
  text,
  jsonb
)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.create_reschedule_request_multislot(
  text,
  jsonb
)
FROM anon;


-- =========================================================
-- 12. HARDEN verify_booking_payment()
-- =========================================================

CREATE OR REPLACE FUNCTION public.verify_booking_payment(
  p_booking_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Authentication required.';
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Administrator access required.';
  END IF;


  IF p_booking_reference IS NULL
     OR trim(p_booking_reference) = '' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Booking reference is required.';
  END IF;


  PERFORM 1
  FROM public.reservations r
  WHERE r.booking_reference = p_booking_reference
    AND r.status = 'confirmed'
    AND r.payment_status = 'pending'
  FOR UPDATE;


  UPDATE public.reservations
  SET
    payment_status = 'verified',
    status = 'confirmed'
  WHERE booking_reference = p_booking_reference
    AND status = 'confirmed'
    AND payment_status = 'pending';


  GET DIAGNOSTICS affected_count = ROW_COUNT;


  IF affected_count = 0 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Booking is no longer pending or could not be found.';
  END IF;

END;
$function$;


-- =========================================================
-- 13. HARDEN reject_booking_payment()
-- =========================================================

CREATE OR REPLACE FUNCTION public.reject_booking_payment(
  p_booking_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Authentication required.';
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Administrator access required.';
  END IF;


  IF p_booking_reference IS NULL
     OR trim(p_booking_reference) = '' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Booking reference is required.';
  END IF;


  PERFORM 1
  FROM public.reservations r
  WHERE r.booking_reference = p_booking_reference
    AND r.status = 'confirmed'
    AND r.payment_status = 'pending'
  FOR UPDATE;


  UPDATE public.reservations
  SET
    payment_status = 'rejected',
    status = 'cancelled'
  WHERE booking_reference = p_booking_reference
    AND status = 'confirmed'
    AND payment_status = 'pending';


  GET DIAGNOSTICS affected_count = ROW_COUNT;


  IF affected_count = 0 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Booking is no longer pending or could not be found.';
  END IF;

END;
$function$;


-- =========================================================
-- 14. PAYMENT RPC EXECUTION
-- =========================================================

REVOKE EXECUTE
ON FUNCTION public.verify_booking_payment(text)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.reject_booking_payment(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.verify_booking_payment(text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.reject_booking_payment(text)
TO authenticated;


-- =========================================================
-- 15. PUBLIC FIND BOOKING — BY REFERENCE
--
-- This replaces direct public SELECT on reservations.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_booking_by_reference(
  p_booking_reference text
)
RETURNS TABLE (
  id uuid,
  court_id uuid,
  date date,
  start_time time,
  end_time time,
  status text,
  payment_type text,
  amount_due numeric,
  payment_status text,
  guest_name text,
  guest_phone text,
  booking_reference text,
  court_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN

  IF p_booking_reference IS NULL
     OR trim(p_booking_reference) = '' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Booking reference is required.';
  END IF;


  RETURN QUERY
  SELECT
    r.id,
    r.court_id,
    r.date,
    r.start_time,
    r.end_time,
    r.status,
    r.payment_type,
    r.amount_due,
    r.payment_status,
    r.guest_name,
    r.guest_phone,
    r.booking_reference,
    c.name AS court_name
  FROM public.reservations r
  LEFT JOIN public.courts c
    ON c.id = r.court_id
  WHERE r.booking_reference = trim(p_booking_reference)
  ORDER BY r.date DESC, r.start_time ASC;

END;
$function$;


-- =========================================================
-- 16. PUBLIC FIND BOOKING — BY PHONE
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_booking_by_phone(
  p_guest_phone text
)
RETURNS TABLE (
  id uuid,
  court_id uuid,
  date date,
  start_time time,
  end_time time,
  status text,
  payment_type text,
  amount_due numeric,
  payment_status text,
  guest_name text,
  guest_phone text,
  booking_reference text,
  court_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN

  IF p_guest_phone IS NULL
     OR trim(p_guest_phone) = '' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Phone number is required.';
  END IF;


  RETURN QUERY
  SELECT
    r.id,
    r.court_id,
    r.date,
    r.start_time,
    r.end_time,
    r.status,
    r.payment_type,
    r.amount_due,
    r.payment_status,
    r.guest_name,
    r.guest_phone,
    r.booking_reference,
    c.name AS court_name
  FROM public.reservations r
  LEFT JOIN public.courts c
    ON c.id = r.court_id
  WHERE r.guest_phone = trim(p_guest_phone)
  ORDER BY r.date DESC, r.start_time ASC;

END;
$function$;


-- =========================================================
-- 17. PUBLIC FIND BOOKING RPC ACCESS
-- =========================================================

REVOKE ALL
ON FUNCTION public.get_public_booking_by_reference(text)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.get_public_booking_by_phone(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_public_booking_by_reference(text)
TO anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.get_public_booking_by_phone(text)
TO anon, authenticated;


-- =========================================================
-- 18. SECURE CUSTOMER / GUEST CANCELLATION
--
-- Registered customer:
--   auth.uid() must match reservation.user_id
--
-- Guest:
--   guest phone must match reservation.guest_phone
--
-- Both:
--   reservation must be confirmed
--   cancellation must be >= 24 hours before start
-- =========================================================

CREATE OR REPLACE FUNCTION public.cancel_customer_reservation(
  p_reservation_id uuid,
  p_guest_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_guest_phone text;
  v_date date;
  v_start_time time;
  v_status text;
  v_booking_start timestamptz;
  v_is_authorized boolean := false;
  v_affected_count integer;
BEGIN

  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Reservation ID is required.';
  END IF;


  SELECT
    r.user_id,
    r.guest_phone,
    r.date,
    r.start_time,
    r.status
  INTO
    v_user_id,
    v_guest_phone,
    v_date,
    v_start_time,
    v_status
  FROM public.reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Reservation not found.';
  END IF;


  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Reservation is no longer active.';
  END IF;


  -- Registered customer cancellation
  IF auth.uid() IS NOT NULL
     AND v_user_id IS NOT NULL
     AND v_user_id = auth.uid() THEN

    v_is_authorized := true;

  END IF;


  -- Guest cancellation
  IF v_user_id IS NULL
     AND p_guest_phone IS NOT NULL
     AND trim(p_guest_phone) = v_guest_phone THEN

    v_is_authorized := true;

  END IF;


  IF NOT v_is_authorized THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'You are not authorized to cancel this reservation.';
  END IF;


  -- Interpret the reservation start in Philippine time.
  v_booking_start :=
    (v_date + v_start_time)
    AT TIME ZONE 'Asia/Manila';


  IF v_booking_start < now() + interval '24 hours' THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Cancellation is only allowed at least 24 hours before the booking.';
  END IF;


  UPDATE public.reservations
  SET status = 'cancelled'
  WHERE id = p_reservation_id
    AND status = 'confirmed';


  GET DIAGNOSTICS v_affected_count = ROW_COUNT;


  IF v_affected_count = 0 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Reservation could not be cancelled.';
  END IF;

END;
$function$;


-- =========================================================
-- 19. CANCELLATION RPC ACCESS
-- =========================================================

REVOKE ALL
ON FUNCTION public.cancel_customer_reservation(uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.cancel_customer_reservation(uuid, text)
TO anon, authenticated;


-- =========================================================
-- 20. REMOVE ANONYMOUS EXECUTION FROM LEGACY PAYMENT RPCs
-- =========================================================

REVOKE EXECUTE
ON FUNCTION public.verify_booking_payment(text)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.reject_booking_payment(text)
FROM anon;


-- =========================================================
-- 21. ENSURE ADMIN RESCHEDULE RPC REMAINS AUTHENTICATED
-- =========================================================

REVOKE EXECUTE
ON FUNCTION public.admin_reschedule_booking(text, jsonb)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.admin_reschedule_booking(text, jsonb)
TO authenticated;


-- =========================================================
-- 22. ENSURE OTHER SAFE AUTHENTICATED RPC ACCESS
-- =========================================================

REVOKE EXECUTE
ON FUNCTION public.get_admin_rescheduled_booking_references()
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.get_pending_reschedule_requests()
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.approve_reschedule_request(uuid)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.reject_reschedule_request(uuid, text)
FROM anon;


COMMIT;