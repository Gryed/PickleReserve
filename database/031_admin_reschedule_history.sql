-- ============================================================
-- 031_admin_reschedule_history.sql
-- PickleReserve - Admin Reschedule History
-- ============================================================

-- ============================================================
-- ADMIN DIRECT RESCHEDULE
-- Record successful admin reschedules in
-- booking_reschedule_requests as APPROVED history.
--
-- IMPORTANT:
-- Reservations remain:
--   status = 'confirmed'
--   payment_status = 'verified'
--
-- This keeps the booking blocking its new time slots.
-- ============================================================

create or replace function public.admin_reschedule_booking(
  p_booking_reference text,
  p_new_slots jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;

  v_reference text;

  v_old_count integer;
  v_new_count integer;

  v_old_date date;
  v_old_court_id uuid;
  v_old_start_time time;
  v_old_end_time time;

  v_new_date date;
  v_new_court_id uuid;
  v_new_start_time time;
  v_new_end_time time;

  v_item jsonb;
begin

  -- ==========================================================
  -- AUTHENTICATION
  -- ==========================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;


  -- ==========================================================
  -- ADMIN ONLY
  -- ==========================================================

  select exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception
      'Only administrators can reschedule bookings.';
  end if;


  -- ==========================================================
  -- BASIC VALIDATION
  -- ==========================================================

  v_reference := trim(coalesce(p_booking_reference, ''));

  if v_reference = '' then
    raise exception 'Booking reference is required.';
  end if;

  if p_new_slots is null
     or jsonb_typeof(p_new_slots) <> 'array'
     or jsonb_array_length(p_new_slots) = 0 then

    raise exception
      'At least one new time slot is required.';
  end if;


  -- ==========================================================
  -- LOCK CURRENT BOOKING
  -- ==========================================================

  perform 1
  from public.reservations
  where booking_reference = v_reference
    and status = 'confirmed'
    and payment_status = 'verified'
  for update;


  -- ==========================================================
  -- COUNT CURRENT BOOKING SLOTS
  -- ==========================================================

  select count(*)
  into v_old_count
  from public.reservations
  where booking_reference = v_reference
    and status = 'confirmed'
    and payment_status = 'verified';

  if v_old_count = 0 then
    raise exception
      'Booking not found or booking is not confirmed and verified.';
  end if;


  -- ==========================================================
  -- GET ORIGINAL SCHEDULE
  --
  -- Used as the old schedule reference in the history row.
  -- For multi-slot bookings this stores the first slot,
  -- while the complete new schedule is stored in new_slots.
  -- ==========================================================

  select
    date,
    court_id,
    start_time,
    end_time
  into
    v_old_date,
    v_old_court_id,
    v_old_start_time,
    v_old_end_time
  from public.reservations
  where booking_reference = v_reference
    and status = 'confirmed'
    and payment_status = 'verified'
  order by date, start_time, id
  limit 1;


  -- ==========================================================
  -- NEW SLOT COUNT
  -- ==========================================================

  v_new_count := jsonb_array_length(p_new_slots);

  if v_new_count <> v_old_count then
    raise exception
      'Reschedule must contain exactly % time slot(s).',
      v_old_count;
  end if;


  -- ==========================================================
  -- VALIDATE NEW SLOTS
  -- ==========================================================

  for v_item in
    select value
    from jsonb_array_elements(p_new_slots)
  loop

    if coalesce(v_item ->> 'court_id', '') = ''
       or coalesce(v_item ->> 'date', '') = ''
       or coalesce(v_item ->> 'start_time', '') = ''
       or coalesce(v_item ->> 'end_time', '') = '' then

      raise exception
        'Each reschedule slot requires court, date, start time and end time.';
    end if;


    v_new_court_id :=
      (v_item ->> 'court_id')::uuid;

    v_new_date :=
      (v_item ->> 'date')::date;

    v_new_start_time :=
      (v_item ->> 'start_time')::time;

    v_new_end_time :=
      (v_item ->> 'end_time')::time;


    if v_new_start_time >= v_new_end_time then
      raise exception
        'Invalid time range in reschedule.';
    end if;


    -- --------------------------------------------------------
    -- Prevent past bookings
    -- --------------------------------------------------------

    if (
      v_new_date + v_new_start_time
    ) < now() then

      raise exception
        'New booking time cannot be in the past.';
    end if;


    -- --------------------------------------------------------
    -- Prevent conflicts with other bookings
    -- --------------------------------------------------------

    if exists (
      select 1
      from public.reservations r
      where r.court_id = v_new_court_id
        and r.date = v_new_date
        and r.start_time = v_new_start_time
        and r.status = 'confirmed'
        and r.payment_status in ('pending', 'verified')
        and r.booking_reference is distinct from v_reference
    ) then

      raise exception
        'One or more selected time slots are already reserved.';
    end if;

  end loop;


  -- ==========================================================
  -- PREVENT DUPLICATE SLOTS
  -- ==========================================================

  if exists (
    select
      v_item ->> 'court_id',
      v_item ->> 'date',
      v_item ->> 'start_time',
      v_item ->> 'end_time'
    from jsonb_array_elements(p_new_slots) as items(v_item)
    group by
      v_item ->> 'court_id',
      v_item ->> 'date',
      v_item ->> 'start_time',
      v_item ->> 'end_time'
    having count(*) > 1
  ) then

    raise exception
      'Duplicate time slots are not allowed.';
  end if;


  -- ==========================================================
  -- UPDATE EXISTING RESERVATION ROWS
  -- ==========================================================

  with old_rows as (
    select
      id,
      row_number() over (
        order by date, start_time, id
      ) as rn
    from public.reservations
    where booking_reference = v_reference
      and status = 'confirmed'
      and payment_status = 'verified'
  ),
  new_rows as (
    select
      value,
      row_number() over (
        order by
          (value ->> 'date')::date,
          (value ->> 'start_time')::time,
          ordinality
      ) as rn
    from jsonb_array_elements(p_new_slots)
      with ordinality as slots(value, ordinality)
  )
  update public.reservations r
  set
    court_id = (n.value ->> 'court_id')::uuid,
    date = (n.value ->> 'date')::date,
    start_time = (n.value ->> 'start_time')::time,
    end_time = (n.value ->> 'end_time')::time,
    payment_status = 'verified'
  from old_rows o
  join new_rows n
    on n.rn = o.rn
  where r.id = o.id;


  -- ==========================================================
  -- GET FIRST NEW SLOT
  --
  -- Used for legacy single-slot columns.
  -- Complete schedule remains in new_slots.
  -- ==========================================================

  select
    (value ->> 'date')::date,
    (value ->> 'court_id')::uuid,
    (value ->> 'start_time')::time,
    (value ->> 'end_time')::time
  into
    v_new_date,
    v_new_court_id,
    v_new_start_time,
    v_new_end_time
  from jsonb_array_elements(p_new_slots)
    with ordinality as slots(value, ordinality)
  order by ordinality
  limit 1;


  -- ==========================================================
  -- SAVE RESCHEDULE HISTORY
  -- ==========================================================

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

    new_slots,

    status,

    requested_by,
    reviewed_by,
    reviewed_at
  )
  values (
    v_reference,

    v_old_date,
    v_old_court_id,
    v_old_start_time,
    v_old_end_time,

    v_new_date,
    v_new_court_id,
    v_new_start_time,
    v_new_end_time,

    p_new_slots,

    'approved',

    v_user_id,
    v_user_id,
    now()
  );

end;
$$;


-- ============================================================
-- EXECUTION PERMISSION
-- ============================================================

revoke all on function public.admin_reschedule_booking(
  text,
  jsonb
) from public;

grant execute on function public.admin_reschedule_booking(
  text,
  jsonb
) to authenticated;


-- ============================================================
-- ADMIN: GET RESCHEDULED BOOKING REFERENCES
--
-- Reservations themselves remain "confirmed".
-- This RPC tells the admin UI which booking references
-- have an approved reschedule history.
-- ============================================================

create or replace function public.get_admin_rescheduled_booking_references()
returns table (
  booking_reference text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct
    brr.booking_reference
  from public.booking_reschedule_requests brr
  where brr.status = 'approved'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  order by brr.booking_reference;
$$;


-- ============================================================
-- EXECUTION PERMISSION
-- ============================================================

revoke all on function
  public.get_admin_rescheduled_booking_references()
from public;

grant execute on function
  public.get_admin_rescheduled_booking_references()
to authenticated;