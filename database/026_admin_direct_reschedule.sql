-- =========================================================
-- 026 ADMIN DIRECT RESCHEDULE
-- =========================================================

create or replace function public.admin_reschedule_booking(
  p_booking_reference text,
  p_new_slots jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_old_count integer;
  v_new_count integer;
begin
  -- =======================================================
  -- AUTHENTICATION
  -- =======================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- =======================================================
  -- ADMIN ONLY
  -- =======================================================

  select exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Only administrators can reschedule bookings.';
  end if;

  -- =======================================================
  -- BASIC VALIDATION
  -- =======================================================

  if trim(coalesce(p_booking_reference, '')) = '' then
    raise exception 'Booking reference is required.';
  end if;

  if p_new_slots is null
     or jsonb_typeof(p_new_slots) <> 'array'
     or jsonb_array_length(p_new_slots) = 0 then
    raise exception 'At least one new time slot is required.';
  end if;

  -- =======================================================
  -- LOCK CURRENT BOOKING
  -- =======================================================

  perform 1
  from public.reservations
  where booking_reference = trim(p_booking_reference)
    and status = 'confirmed'
    and payment_status = 'verified'
  for update;

  select count(*)
  into v_old_count
  from public.reservations
  where booking_reference = trim(p_booking_reference)
    and status = 'confirmed'
    and payment_status = 'verified';

  if v_old_count = 0 then
    raise exception
      'Booking not found or booking is not confirmed and verified.';
  end if;

  -- =======================================================
  -- NEW SLOT COUNT
  -- =======================================================

  v_new_count := jsonb_array_length(p_new_slots);

  if v_new_count <> v_old_count then
    raise exception
      'Reschedule must contain exactly % time slot(s).',
      v_old_count;
  end if;

  -- =======================================================
  -- VALIDATE NEW SLOTS
  -- =======================================================

  if exists (
    select 1
    from jsonb_array_elements(p_new_slots) as slot
    where coalesce(slot->>'court_id', '') = ''
       or coalesce(slot->>'date', '') = ''
       or coalesce(slot->>'start_time', '') = ''
       or coalesce(slot->>'end_time', '') = ''
  ) then
    raise exception 'Each reschedule slot requires court, date, start time and end time.';
  end if;

  -- =======================================================
  -- PREVENT PAST BOOKINGS
  -- =======================================================

  if exists (
    select 1
    from jsonb_array_elements(p_new_slots) as slot
    where (
      (slot->>'date')::date +
      (slot->>'start_time')::time
    ) < now()
  ) then
    raise exception 'New booking time cannot be in the past.';
  end if;

  -- =======================================================
  -- PREVENT DUPLICATE SLOTS IN REQUEST
  -- =======================================================

  if exists (
    select
      slot->>'court_id',
      slot->>'date',
      slot->>'start_time',
      slot->>'end_time'
    from jsonb_array_elements(p_new_slots) as slot
    group by
      slot->>'court_id',
      slot->>'date',
      slot->>'start_time',
      slot->>'end_time'
    having count(*) > 1
  ) then
    raise exception 'Duplicate time slots are not allowed.';
  end if;

  -- =======================================================
  -- CONFLICT CHECK
  -- =======================================================

  if exists (
    select 1
    from jsonb_array_elements(p_new_slots) as slot
    join public.reservations r
      on r.court_id = (slot->>'court_id')::uuid
     and r.date = (slot->>'date')::date
     and r.start_time = (slot->>'start_time')::time
     and r.status = 'confirmed'
     and r.payment_status in ('pending', 'verified')
     and r.booking_reference is distinct from trim(p_booking_reference)
  ) then
    raise exception
      'One or more selected time slots are already reserved.';
  end if;

  -- =======================================================
  -- UPDATE BOOKING
  --
  -- Same booking reference.
  -- Same payment status = verified.
  -- Only date/court/time changes.
  -- =======================================================

  with old_rows as (
    select
      id,
      row_number() over (
        order by date, start_time, id
      ) as rn
    from public.reservations
    where booking_reference = trim(p_booking_reference)
      and status = 'confirmed'
      and payment_status = 'verified'
  ),
  new_rows as (
    select
      (slot->>'court_id')::uuid as court_id,
      (slot->>'date')::date as date,
      (slot->>'start_time')::time as start_time,
      (slot->>'end_time')::time as end_time,
      row_number() over (
        order by
          (slot->>'date')::date,
          (slot->>'start_time')::time,
          ordinality
      ) as rn
    from jsonb_array_elements(p_new_slots)
      with ordinality as slots(slot, ordinality)
  )
  update public.reservations r
  set
    court_id = n.court_id,
    date = n.date,
    start_time = n.start_time,
    end_time = n.end_time,
    payment_status = 'verified'
  from old_rows o
  join new_rows n
    on n.rn = o.rn
  where r.id = o.id;

end;
$$;

-- =========================================================
-- EXECUTION PERMISSION
-- =========================================================

revoke all on function public.admin_reschedule_booking(
  text,
  jsonb
) from public;

grant execute on function public.admin_reschedule_booking(
  text,
  jsonb
) to authenticated;