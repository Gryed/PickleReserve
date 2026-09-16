-- ============================================================
-- PICKLERESERVE
-- PHASE 4A — SECURITY HARDENING
-- 039_admin_create_booking.sql
--
-- Purpose:
-- Replace direct public reservation INSERT with a secure
-- authenticated-admin RPC for Admin Create Booking.
-- ============================================================

create or replace function public.admin_create_booking(
  p_court_id uuid,
  p_user_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_payment_type text,
  p_amount_due numeric,
  p_payment_proof_url text,
  p_booking_reference text
)
returns public.reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations;
  v_role text;
begin
  -- ==========================================================
  -- 1. AUTHENTICATION
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select p.role
    into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role <> 'admin' then
    raise exception 'Admin access required.';
  end if;


  -- ==========================================================
  -- 2. BASIC VALIDATION
  -- ==========================================================

  if p_court_id is null then
    raise exception 'Court is required.';
  end if;

  if p_date is null then
    raise exception 'Booking date is required.';
  end if;

  if p_start_time is null or p_end_time is null then
    raise exception 'Booking time is required.';
  end if;

  if p_start_time >= p_end_time then
    raise exception 'Invalid booking time range.';
  end if;

  if p_payment_type not in ('full', 'deposit') then
    raise exception 'Invalid payment type.';
  end if;

  if p_amount_due is null or p_amount_due <= 0 then
    raise exception 'Invalid booking amount.';
  end if;

  if p_booking_reference is null
     or trim(p_booking_reference) = '' then
    raise exception 'Booking reference is required.';
  end if;


  -- ==========================================================
  -- 3. CUSTOMER / GUEST VALIDATION
  -- ==========================================================

  if p_user_id is null then

    if p_guest_name is null
       or trim(p_guest_name) = '' then
      raise exception 'Guest name is required.';
    end if;

    if p_guest_phone is null
       or trim(p_guest_phone) = '' then
      raise exception 'Guest phone is required.';
    end if;

  else

    if not exists (
      select 1
      from auth.users u
      where u.id = p_user_id
    ) then
      raise exception 'Selected customer does not exist.';
    end if;

  end if;


  -- ==========================================================
  -- 4. COURT VALIDATION
  -- ==========================================================

  if not exists (
    select 1
    from public.courts c
    where c.id = p_court_id
      and c.status = 'available'
  ) then
    raise exception 'Selected court is not available.';
  end if;


  -- ==========================================================
  -- 5. CONFLICT CHECK
  --
  -- Admin booking must respect the same reservation boundary
  -- used by the existing booking system.
  -- ==========================================================

  if exists (
    select 1
    from public.reservations r
    where r.court_id = p_court_id
      and r.date = p_date
      and r.start_time < p_end_time
      and r.end_time > p_start_time
      and r.status = 'confirmed'
      and r.payment_status in ('pending', 'verified')
  ) then
    raise exception 'One or more selected slots are no longer available.';
  end if;


  -- ==========================================================
  -- 6. INSERT
  --
  -- Admin-created bookings are immediately verified.
  -- ==========================================================

  insert into public.reservations (
    court_id,
    user_id,
    guest_name,
    guest_phone,
    date,
    start_time,
    end_time,
    status,
    payment_type,
    amount_due,
    payment_status,
    payment_proof_url,
    booking_reference
  )
  values (
    p_court_id,
    p_user_id,
    case
      when p_user_id is null
        then trim(p_guest_name)
      else null
    end,
    case
      when p_user_id is null
        then trim(p_guest_phone)
      else null
    end,
    p_date,
    p_start_time,
    p_end_time,
    'confirmed',
    p_payment_type,
    p_amount_due,
    'verified',
    p_payment_proof_url,
    trim(p_booking_reference)
  )
  returning *
  into v_reservation;


  return v_reservation;
end;
$$;


-- ============================================================
-- 7. LOCK DOWN EXECUTION
-- ============================================================

revoke all on function public.admin_create_booking(
  uuid,
  uuid,
  text,
  text,
  date,
  time,
  time,
  text,
  numeric,
  text,
  text
) from public;

revoke all on function public.admin_create_booking(
  uuid,
  uuid,
  text,
  text,
  date,
  time,
  time,
  text,
  numeric,
  text,
  text
) from anon;

grant execute on function public.admin_create_booking(
  uuid,
  uuid,
  text,
  text,
  date,
  time,
  time,
  text,
  numeric,
  text,
  text
) to authenticated;


-- ============================================================
-- 8. REMOVE PUBLIC DIRECT INSERT
-- ============================================================

drop policy if exists
  "Users can book with account or as guest"
on public.reservations;


-- ============================================================
-- 9. AUDIT RESULT
-- ============================================================

-- Expected:
-- Public/anon cannot INSERT reservations directly.
-- Authenticated customers cannot INSERT reservations directly.
-- Admin Create Booking uses admin_create_booking().