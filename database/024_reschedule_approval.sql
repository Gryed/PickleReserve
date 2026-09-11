-- ============================================================
-- 024_reschedule_approval.sql
-- PickleReserve - Atomic Reschedule Approval
-- ============================================================

-- ============================================================
-- SUPPORT MULTI-SLOT RESCHEDULE REQUESTS
-- ============================================================

alter table public.booking_reschedule_requests
add column if not exists new_slots jsonb;

-- ============================================================
-- APPROVE RESCHEDULE REQUEST
-- ============================================================

create or replace function public.approve_reschedule_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.booking_reschedule_requests;
  booking_count integer;
  new_slot_count integer;
  item jsonb;

  new_court_id uuid;
  new_date date;
  new_start_time time;
  new_end_time time;

  conflict_count integer;
begin

  if p_request_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Reschedule request ID is required.';
  end if;

  -- ==========================================================
  -- LOCK THE RESCHEDULE REQUEST
  -- ==========================================================

  select *
  into request_row
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Reschedule request could not be found.';
  end if;

  if request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'This reschedule request is no longer pending.';
  end if;

  -- ==========================================================
  -- VERIFY ACTIVE BOOKING
  -- ==========================================================

  select count(*)
  into booking_count
  from public.reservations
  where booking_reference = request_row.booking_reference
    and status = 'confirmed'
    and payment_status = 'verified';

  if booking_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'The original booking is no longer active.';
  end if;

  -- ==========================================================
  -- MULTI-SLOT REQUEST
  --
  -- Expected JSON format:
  --
  -- [
  --   {
  --     "court_id": "...",
  --     "date": "2026-09-20",
  --     "start_time": "18:00",
  --     "end_time": "19:00"
  --   },
  --   {
  --     "court_id": "...",
  --     "date": "2026-09-20",
  --     "start_time": "19:00",
  --     "end_time": "20:00"
  --   }
  -- ]
  -- ==========================================================

  if request_row.new_slots is not null
     and jsonb_typeof(request_row.new_slots) = 'array'
     and jsonb_array_length(request_row.new_slots) > 0 then

    new_slot_count :=
      jsonb_array_length(request_row.new_slots);

    if new_slot_count <> booking_count then
      raise exception using
        errcode = 'P0001',
        message =
          'The number of new time slots must match the existing booking.';
    end if;

    -- --------------------------------------------------------
    -- Validate every requested slot
    -- --------------------------------------------------------

    for item in
      select value
      from jsonb_array_elements(request_row.new_slots)
    loop

      new_court_id :=
        nullif(item ->> 'court_id', '')::uuid;

      new_date :=
        nullif(item ->> 'date', '')::date;

      new_start_time :=
        nullif(item ->> 'start_time', '')::time;

      new_end_time :=
        nullif(item ->> 'end_time', '')::time;

      if new_court_id is null
         or new_date is null
         or new_start_time is null
         or new_end_time is null then

        raise exception using
          errcode = 'P0001',
          message = 'Invalid slot data in reschedule request.';
      end if;

      if new_start_time >= new_end_time then
        raise exception using
          errcode = 'P0001',
          message = 'Invalid time range in reschedule request.';
      end if;

      -- ------------------------------------------------------
      -- Check conflict against other bookings
      -- ------------------------------------------------------

      select count(*)
      into conflict_count
      from public.reservations r
      where r.court_id = new_court_id
        and r.date = new_date
        and r.start_time = new_start_time
        and r.status = 'confirmed'
        and r.payment_status in ('pending', 'verified')
        and r.booking_reference <> request_row.booking_reference;

      if conflict_count > 0 then
        raise exception using
          errcode = 'P0001',
          message =
            'One or more requested time slots are no longer available.';
      end if;

    end loop;

    -- --------------------------------------------------------
    -- Update existing reservation rows.
    --
    -- We use row_number() so each existing slot receives
    -- exactly one requested slot.
    -- --------------------------------------------------------

    with old_rows as (
      select
        id,
        row_number() over (
          order by date, start_time, id
        ) as rn
      from public.reservations
      where booking_reference = request_row.booking_reference
        and status = 'confirmed'
        and payment_status = 'verified'
    ),
    new_rows as (
      select
        value,
        row_number() over () as rn
      from jsonb_array_elements(request_row.new_slots)
    )
    update public.reservations r
    set
      court_id = (n.value ->> 'court_id')::uuid,
      date = (n.value ->> 'date')::date,
      start_time = (n.value ->> 'start_time')::time,
      end_time = (n.value ->> 'end_time')::time
    from old_rows o
    join new_rows n
      on n.rn = o.rn
    where r.id = o.id;

  else

    -- ========================================================
    -- LEGACY / SINGLE-SLOT REQUEST
    -- ========================================================

    select count(*)
    into conflict_count
    from public.reservations r
    where r.court_id = request_row.new_court_id
      and r.date = request_row.new_date
      and r.start_time = request_row.new_start_time
      and r.status = 'confirmed'
      and r.payment_status in ('pending', 'verified')
      and r.booking_reference <> request_row.booking_reference;

    if conflict_count > 0 then
      raise exception using
        errcode = 'P0001',
        message =
          'The requested time slot is no longer available.';
    end if;

    /*
      Single-slot requests are intended for bookings
      containing one reservation row.
    */

    if booking_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message =
          'This booking contains multiple slots. A multi-slot reschedule request is required.';
    end if;

    update public.reservations
    set
      court_id = request_row.new_court_id,
      date = request_row.new_date,
      start_time = request_row.new_start_time,
      end_time = request_row.new_end_time
    where booking_reference = request_row.booking_reference
      and status = 'confirmed'
      and payment_status = 'verified';

  end if;

  -- ==========================================================
  -- MARK REQUEST APPROVED
  -- ==========================================================

  update public.booking_reschedule_requests
  set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = request_row.id;

end;
$$;

-- ============================================================
-- REJECT RESCHEDULE REQUEST
-- ============================================================

create or replace function public.reject_reschedule_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.booking_reschedule_requests;
begin

  if p_request_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Reschedule request ID is required.';
  end if;

  select *
  into request_row
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Reschedule request could not be found.';
  end if;

  if request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'This reschedule request is no longer pending.';
  end if;

  update public.booking_reschedule_requests
  set
    status = 'rejected',
    rejection_reason =
      nullif(trim(p_rejection_reason), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = request_row.id;

end;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

grant execute on function public.approve_reschedule_request(uuid)
to authenticated;

grant execute on function public.reject_reschedule_request(uuid, text)
to authenticated;