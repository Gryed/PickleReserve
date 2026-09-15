-- ============================================================
-- PICKLERESERVE
-- 035_admin_reschedule_db_closure.sql
--
-- DB closure for Messenger -> Admin Direct Reschedule workflow
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTEND EXISTING HISTORY TABLE
-- ============================================================

ALTER TABLE public.booking_reschedule_requests
ADD COLUMN IF NOT EXISTS old_slots jsonb;

COMMENT ON COLUMN public.booking_reschedule_requests.old_slots
IS 'Complete set of reservation slots before an admin direct reschedule.';


-- ============================================================
-- 2. REMOVE LEGACY TRIGGER-BASED RESCHEDULE HISTORY
-- ============================================================

DROP TRIGGER IF EXISTS trg_track_admin_reschedule
ON public.reservations;


-- ============================================================
-- 3. REMOVE AUTOMATIC RESCHEDULE NOTIFICATION TRIGGER
--    Messenger is the communication channel.
-- ============================================================

DROP TRIGGER IF EXISTS trg_notify_admin_booking_rescheduled
ON public.booking_reschedule_requests;


-- ============================================================
-- 4. REPLACE ADMIN DIRECT RESCHEDULE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_reschedule_booking(
  p_booking_reference text,
  p_new_slots jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$

DECLARE
  v_user_id uuid;
  v_is_admin boolean;

  v_reference text;

  v_old_count integer;
  v_new_count integer;

  v_original_booking_time timestamp;
  v_now timestamp;

  v_old_slots jsonb;

  v_first_old_date date;
  v_first_old_court_id uuid;
  v_first_old_start_time time;
  v_first_old_end_time time;

  v_first_new_date date;
  v_first_new_court_id uuid;
  v_first_new_start_time time;
  v_first_new_end_time time;

BEGIN

  -- ==========================================================
  -- A. AUTHENTICATION
  -- ==========================================================

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;


  -- ==========================================================
  -- B. ADMIN CHECK
  -- ==========================================================

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND role = 'admin'
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can reschedule bookings.';
  END IF;


  -- ==========================================================
  -- C. BASIC INPUT VALIDATION
  -- ==========================================================

  v_reference := trim(coalesce(p_booking_reference, ''));

  IF v_reference = '' THEN
    RAISE EXCEPTION 'Booking reference is required.';
  END IF;

  IF p_new_slots IS NULL
     OR jsonb_typeof(p_new_slots) <> 'array'
     OR jsonb_array_length(p_new_slots) = 0
  THEN
    RAISE EXCEPTION 'At least one new time slot is required.';
  END IF;


  -- ==========================================================
  -- D. LOCK THE ENTIRE BOOKING
  --
  -- This prevents another admin operation from modifying
  -- these rows while this reschedule transaction is running.
  -- ==========================================================

  PERFORM 1
  FROM public.reservations
  WHERE booking_reference = v_reference
    AND status = 'confirmed'
    AND payment_status = 'verified'
  FOR UPDATE;


  -- ==========================================================
  -- E. VERIFY BOOKING EXISTS
  -- ==========================================================

  SELECT count(*)
  INTO v_old_count
  FROM public.reservations
  WHERE booking_reference = v_reference
    AND status = 'confirmed'
    AND payment_status = 'verified';

  IF v_old_count = 0 THEN
    RAISE EXCEPTION
      'Booking not found or booking is not confirmed and verified.';
  END IF;


  -- ==========================================================
  -- F. ONE-TIME RESCHEDULE RULE
  --
  -- Any previous successful admin/customer-approved reschedule
  -- consumes the one allowed reschedule.
  -- ==========================================================

  IF EXISTS (
    SELECT 1
    FROM public.booking_reschedule_requests
    WHERE booking_reference = v_reference
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'This booking has already been rescheduled once.';
  END IF;


  -- ==========================================================
  -- G. CAPTURE ORIGINAL BOOKING TIME
  --
  -- For multi-slot bookings, the earliest original slot is
  -- treated as the original booking time.
  -- ==========================================================

  SELECT
    (r.date::timestamp + r.start_time)
  INTO v_original_booking_time
  FROM public.reservations r
  WHERE r.booking_reference = v_reference
    AND r.status = 'confirmed'
    AND r.payment_status = 'verified'
  ORDER BY r.date, r.start_time, r.id
  LIMIT 1;


  v_now := now()::timestamp;


  -- ==========================================================
  -- H. 24-HOUR RULE
  -- ==========================================================

  IF v_original_booking_time < v_now + interval '24 hours' THEN
    RAISE EXCEPTION
      'Reschedule must be completed at least 24 hours before the original booking time.';
  END IF;


  -- ==========================================================
  -- I. NEW SLOT COUNT MUST MATCH OLD SLOT COUNT
  -- ==========================================================

  v_new_count := jsonb_array_length(p_new_slots);

  IF v_new_count <> v_old_count THEN
    RAISE EXCEPTION
      'Reschedule must contain exactly % time slot(s).',
      v_old_count;
  END IF;


  -- ==========================================================
  -- J. VALIDATE REQUIRED SLOT FIELDS
  -- ==========================================================

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_new_slots) AS slot
    WHERE coalesce(slot->>'court_id', '') = ''
       OR coalesce(slot->>'date', '') = ''
       OR coalesce(slot->>'start_time', '') = ''
       OR coalesce(slot->>'end_time', '') = ''
  ) THEN
    RAISE EXCEPTION
      'Each reschedule slot requires court, date, start time and end time.';
  END IF;


  -- ==========================================================
  -- K. VALIDATE NEW SLOT TIME
  -- ==========================================================

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_new_slots) AS slot
    WHERE
      (
        (slot->>'date')::date +
        (slot->>'start_time')::time
      ) < now()
  ) THEN
    RAISE EXCEPTION
      'New booking time cannot be in the past.';
  END IF;


  -- ==========================================================
  -- L. PREVENT DUPLICATE NEW SLOTS
  -- ==========================================================

  IF EXISTS (
    SELECT
      slot->>'court_id',
      slot->>'date',
      slot->>'start_time',
      slot->>'end_time'
    FROM jsonb_array_elements(p_new_slots) AS slot
    GROUP BY
      slot->>'court_id',
      slot->>'date',
      slot->>'start_time',
      slot->>'end_time'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate time slots are not allowed.';
  END IF;


  -- ==========================================================
  -- M. PREVENT BOOKING CONFLICTS
  -- ==========================================================

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_new_slots) AS slot
    JOIN public.reservations r
      ON r.court_id = (slot->>'court_id')::uuid
     AND r.date = (slot->>'date')::date
     AND r.start_time = (slot->>'start_time')::time
     AND r.status = 'confirmed'
     AND r.payment_status IN ('pending', 'verified')
     AND r.booking_reference IS DISTINCT FROM v_reference
  ) THEN
    RAISE EXCEPTION
      'One or more selected time slots are already reserved.';
  END IF;


  -- ==========================================================
  -- N. CAPTURE COMPLETE OLD SLOT SET
  -- ==========================================================

  SELECT jsonb_agg(
    jsonb_build_object(
      'court_id', r.court_id,
      'date', r.date,
      'start_time', r.start_time,
      'end_time', r.end_time
    )
    ORDER BY r.date, r.start_time, r.id
  )
  INTO v_old_slots
  FROM public.reservations r
  WHERE r.booking_reference = v_reference
    AND r.status = 'confirmed'
    AND r.payment_status = 'verified';


  -- ==========================================================
  -- O. CAPTURE FIRST OLD SLOT FOR LEGACY HISTORY COLUMNS
  -- ==========================================================

  SELECT
    r.date,
    r.court_id,
    r.start_time,
    r.end_time
  INTO
    v_first_old_date,
    v_first_old_court_id,
    v_first_old_start_time,
    v_first_old_end_time
  FROM public.reservations r
  WHERE r.booking_reference = v_reference
    AND r.status = 'confirmed'
    AND r.payment_status = 'verified'
  ORDER BY r.date, r.start_time, r.id
  LIMIT 1;


  -- ==========================================================
  -- P. CAPTURE FIRST NEW SLOT FOR LEGACY HISTORY COLUMNS
  -- ==========================================================

  SELECT
    (value ->> 'date')::date,
    (value ->> 'court_id')::uuid,
    (value ->> 'start_time')::time,
    (value ->> 'end_time')::time
  INTO
    v_first_new_date,
    v_first_new_court_id,
    v_first_new_start_time,
    v_first_new_end_time
  FROM jsonb_array_elements(p_new_slots)
       WITH ORDINALITY AS slots(value, ordinality)
  ORDER BY ordinality
  LIMIT 1;


  -- ==========================================================
  -- Q. ATOMIC MULTI-SLOT UPDATE
  -- ==========================================================

  WITH old_rows AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY date, start_time, id
      ) AS rn
    FROM public.reservations
    WHERE booking_reference = v_reference
      AND status = 'confirmed'
      AND payment_status = 'verified'
  ),

  new_rows AS (
    SELECT
      (slot->>'court_id')::uuid AS court_id,
      (slot->>'date')::date AS date,
      (slot->>'start_time')::time AS start_time,
      (slot->>'end_time')::time AS end_time,

      row_number() OVER (
        ORDER BY
          (slot->>'date')::date,
          (slot->>'start_time')::time,
          ordinality
      ) AS rn

    FROM jsonb_array_elements(p_new_slots)
         WITH ORDINALITY AS slots(slot, ordinality)
  )

  UPDATE public.reservations r
  SET
    court_id = n.court_id,
    date = n.date,
    start_time = n.start_time,
    end_time = n.end_time,
    payment_status = 'verified'

  FROM old_rows o
  JOIN new_rows n
    ON n.rn = o.rn

  WHERE r.id = o.id;


  -- ==========================================================
  -- R. SAVE ONE COMPLETE HISTORY RECORD
  -- ==========================================================

  INSERT INTO public.booking_reschedule_requests (
    booking_reference,

    old_date,
    old_court_id,
    old_start_time,
    old_end_time,

    new_date,
    new_court_id,
    new_start_time,
    new_end_time,

    old_slots,
    new_slots,

    status,

    requested_by,
    reviewed_by,
    reviewed_at
  )
  VALUES (
    v_reference,

    v_first_old_date,
    v_first_old_court_id,
    v_first_old_start_time,
    v_first_old_end_time,

    v_first_new_date,
    v_first_new_court_id,
    v_first_new_start_time,
    v_first_new_end_time,

    v_old_slots,
    p_new_slots,

    'approved',

    v_user_id,
    v_user_id,
    now()
  );


  -- ==========================================================
  -- S. FINISHED
  -- ==========================================================

END;

$function$;


-- ============================================================
-- 5. FUNCTION PERMISSION
-- ============================================================

REVOKE ALL
ON FUNCTION public.admin_reschedule_booking(text, jsonb)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_reschedule_booking(text, jsonb)
TO authenticated;


COMMIT;