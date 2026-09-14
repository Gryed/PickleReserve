-- ============================================================
-- 033_customer_reschedule_rules.sql
-- PickleReserve - Customer Reschedule Eligibility Rules
-- ============================================================

-- Customer reschedule requests must:
--   1. Belong to an active confirmed + verified booking.
--   2. Be requested at least 24 hours before the original start.
--   3. Have no existing pending request.
--   4. Have no previous approved customer reschedule.
--
-- Admin direct reschedules remain unaffected because they use
-- admin_reschedule_booking() separately.

create or replace function public.create_reschedule_request(
  p_booking_reference text,
  p_new_date date,
  p_new_court_id uuid,
  p_new_start_time time,
  p_new_end_time time
)
returns public.booking_reschedule_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.reservations;
  existing_request public.booking_reschedule_requests;
  approved_request public.booking_reschedule_requests;
  new_request public.booking_reschedule_requests;
  original_start timestamptz;
begin
  if p_booking_reference is null
     or trim(p_booking_reference) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'Booking reference is required.';
  end if;

  if p_new_date is null
     or p_new_court_id is null
     or p_new_start_time is null
     or p_new_end_time is null then
    raise exception using
      errcode = 'P0001',
      message = 'New booking date, court, and time are required.';
  end if;

  if p_new_start_time >= p_new_end_time then
    raise exception using
      errcode = 'P0001',
      message = 'Invalid new booking time range.';
  end if;

  select *
  into booking_row
  from public.reservations
  where booking_reference = trim(p_booking_reference)
    and status = 'confirmed'
    and payment_status = 'verified'
  order by date, start_time
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Verified active booking could not be found.';
  end if;

  -- Customer must own the booking when authenticated.
  if auth.uid() is not null
     and booking_row.user_id is not null
     and booking_row.user_id <> auth.uid() then
    raise exception using
      errcode = 'P0001',
      message = 'You are not authorized to reschedule this booking.';
  end if;

  -- Original booking must be at least 24 hours away.
  original_start :=
    (
      booking_row.date::text
      || ' '
      || booking_row.start_time::text
    )::timestamptz;

  if original_start < now() + interval '24 hours' then
    raise exception using
      errcode = 'P0001',
      message = 'Reschedule is only available at least 24 hours before your scheduled booking.';
  end if;

  -- Only one customer reschedule may ever be approved.
  select *
  into approved_request
  from public.booking_reschedule_requests
  where booking_reference = trim(p_booking_reference)
    and status = 'approved'
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'This booking has already used its one reschedule.';
  end if;

  -- Prevent multiple pending requests.
  select *
  into existing_request
  from public.booking_reschedule_requests
  where booking_reference = trim(p_booking_reference)
    and status = 'pending'
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'This booking already has a pending reschedule request.';
  end if;

  -- Prevent requesting the exact same schedule.
  if booking_row.date = p_new_date
     and booking_row.court_id = p_new_court_id
     and booking_row.start_time = p_new_start_time
     and booking_row.end_time = p_new_end_time then
    raise exception using
      errcode = 'P0001',
      message = 'The new schedule is the same as the current schedule.';
  end if;

  insert into public.booking_reschedule_requests (
    booking_reference,
    old_date,
    old_court_id,
    old_start_time,
    old_end_time,
    new_date,
    new_court_id,
    new_start_time,
    new_end_time,
    status,
    requested_by
  )
  values (
    trim(p_booking_reference),
    booking_row.date,
    booking_row.court_id,
    booking_row.start_time,
    booking_row.end_time,
    p_new_date,
    p_new_court_id,
    p_new_start_time,
    p_new_end_time,
    'pending',
    auth.uid()
  )
  returning * into new_request;

  return new_request;
end;
$$;

grant execute on function public.create_reschedule_request(
  text,
  date,
  uuid,
  time,
  time
)
to anon, authenticated;