
-- ============================================================
-- 034_reschedule_admin_workflow.sql
-- PickleReserve - Secure Admin Reschedule Approval Workflow
-- ============================================================

-- ============================================================
-- ADMIN AUTH HELPER
-- ============================================================

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public;

grant execute on function public.is_current_user_admin()
to authenticated;


-- ============================================================
-- GET PENDING RESCHEDULE REQUESTS
-- ============================================================

create or replace function public.get_pending_reschedule_requests()
returns setof public.booking_reschedule_requests
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin

  if not public.is_current_user_admin() then
    raise exception using
      errcode = '42501',
      message =
        'Only administrators can view pending reschedule requests.';
  end if;

  return query
    select r.*
    from public.booking_reschedule_requests r
    where r.status = 'pending'
    order by r.created_at asc;

end;
$$;

revoke all on function public.get_pending_reschedule_requests()
from public;

grant execute on function public.get_pending_reschedule_requests()
to authenticated;


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

  -- ==========================================================
  -- ADMIN CHECK
  -- ==========================================================

  if not public.is_current_user_admin() then
    raise exception using
      errcode = '42501',
      message =
        'Only administrators can approve reschedule requests.';
  end if;


  -- ==========================================================
  -- REQUEST ID
  -- ==========================================================

  if p_request_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Reschedule request ID is required.';
  end if;


  -- ==========================================================
  -- LOCK REQUEST
  -- ==========================================================

  select *
  into request_row
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'Reschedule request could not be found.';
  end if;


  -- ==========================================================
  -- MUST STILL BE PENDING
  -- ==========================================================

  if request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message =
        'This reschedule request is no longer pending.';
  end if;


  -- ==========================================================
  -- CHECK ORIGINAL BOOKING
  -- ==========================================================

  select count(*)
  into booking_count
  from public.reservations
  where booking_reference =
        request_row.booking_reference
    and status = 'confirmed'
    and payment_status = 'verified';

  if booking_count = 0 then
    raise exception using
      errcode = 'P0001',
      message =
        'The original booking is no longer active.';
  end if;


  -- ==========================================================
  -- MULTI-SLOT REQUEST
  -- ==========================================================

  if request_row.new_slots is not null
     and jsonb_typeof(request_row.new_slots) = 'array'
     and jsonb_array_length(request_row.new_slots) > 0 then

    new_slot_count =
      jsonb_array_length(request_row.new_slots);

    if new_slot_count <> booking_count then
      raise exception using
        errcode = 'P0001',
        message =
          'The number of new time slots must match the existing booking.';
    end if;


    -- --------------------------------------------------------
    -- VALIDATE EVERY SLOT
    -- --------------------------------------------------------

    for item in
      select value
      from jsonb_array_elements(
        request_row.new_slots
      )
    loop

      new_court_id :=
        nullif(
          item ->> 'court_id',
          ''
        )::uuid;

      new_date :=
        nullif(
          item ->> 'date',
          ''
        )::date;

      new_start_time :=
        nullif(
          item ->> 'start_time',
          ''
        )::time;

      new_end_time :=
        nullif(
          item ->> 'end_time',
          ''
        )::time;


      if new_court_id is null
         or new_date is null
         or new_start_time is null
         or new_end_time is null then

        raise exception using
          errcode = 'P0001',
          message =
            'Invalid slot data in reschedule request.';
      end if;


      if new_start_time >= new_end_time then
        raise exception using
          errcode = 'P0001',
          message =
            'Invalid time range in reschedule request.';
      end if;


      -- ------------------------------------------------------
      -- PREVENT PAST BOOKING
      -- ------------------------------------------------------

      if (
        new_date + new_start_time
      ) < now() then

        raise exception using
          errcode = 'P0001',
          message =
            'Requested booking time cannot be in the past.';
      end if;


      -- ------------------------------------------------------
      -- CHECK CONFLICT
      -- ------------------------------------------------------

      select count(*)
      into conflict_count
      from public.reservations r
      where r.court_id = new_court_id
        and r.date = new_date
        and r.start_time = new_start_time
        and r.status = 'confirmed'
        and r.payment_status in (
          'pending',
          'verified'
        )
        and r.booking_reference <>
            request_row.booking_reference;


      if conflict_count > 0 then
        raise exception using
          errcode = 'P0001',
          message =
            'One or more requested time slots are no longer available.';
      end if;

    end loop;


    -- ========================================================
    -- UPDATE EXISTING RESERVATION ROWS
    -- ========================================================

    with old_rows as (
      select
        id,
        row_number() over (
          order by date, start_time, id
        ) as rn
      from public.reservations
      where booking_reference =
            request_row.booking_reference
        and status = 'confirmed'
        and payment_status = 'verified'
    ),

    new_rows as (
      select
        value,
        row_number() over (
          order by ordinality
        ) as rn
      from jsonb_array_elements(
        request_row.new_slots
      )
      with ordinality as slots(
        value,
        ordinality
      )
    )

    update public.reservations r

    set
      court_id =
        (n.value ->> 'court_id')::uuid,

      date =
        (n.value ->> 'date')::date,

      start_time =
        (n.value ->> 'start_time')::time,

      end_time =
        (n.value ->> 'end_time')::time

    from old_rows o

    join new_rows n
      on n.rn = o.rn

    where r.id = o.id;


  -- ==========================================================
  -- SINGLE-SLOT REQUEST
  -- ==========================================================

  else

    if booking_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message =
          'This booking contains multiple slots. A multi-slot reschedule request is required.';
    end if;


    -- --------------------------------------------------------
    -- PREVENT PAST BOOKING
    -- --------------------------------------------------------

    if (
      request_row.new_date +
      request_row.new_start_time
    ) < now() then

      raise exception using
        errcode = 'P0001',
        message =
          'Requested booking time cannot be in the past.';
    end if;


    -- --------------------------------------------------------
    -- CHECK CONFLICT
    -- --------------------------------------------------------

    select count(*)
    into conflict_count
    from public.reservations r
    where r.court_id =
          request_row.new_court_id

      and r.date =
          request_row.new_date

      and r.start_time =
          request_row.new_start_time

      and r.status =
          'confirmed'

      and r.payment_status in (
        'pending',
        'verified'
      )

      and r.booking_reference <>
          request_row.booking_reference;


    if conflict_count > 0 then
      raise exception using
        errcode = 'P0001',
        message =
          'The requested time slot is no longer available.';
    end if;


    -- --------------------------------------------------------
    -- UPDATE BOOKING
    -- --------------------------------------------------------

    update public.reservations

    set
      court_id =
        request_row.new_court_id,

      date =
        request_row.new_date,

      start_time =
        request_row.new_start_time,

      end_time =
        request_row.new_end_time

    where booking_reference =
          request_row.booking_reference

      and status =
          'confirmed'

      and payment_status =
          'verified';

  end if;


  -- ==========================================================
  -- MARK REQUEST APPROVED
  -- ==========================================================

  update public.booking_reschedule_requests

  set
    status = 'approved',

    reviewed_by =
      auth.uid(),

    reviewed_at =
      now(),

    updated_at =
      now()

  where id =
        request_row.id;

end;
$$;


revoke all on function
  public.approve_reschedule_request(uuid)
from public;

grant execute on function
  public.approve_reschedule_request(uuid)
to authenticated;


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

  -- ==========================================================
  -- ADMIN CHECK
  -- ==========================================================

  if not public.is_current_user_admin() then
    raise exception using
      errcode = '42501',
      message =
        'Only administrators can reject reschedule requests.';
  end if;


  -- ==========================================================
  -- REQUEST ID
  -- ==========================================================

  if p_request_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Reschedule request ID is required.';
  end if;


  -- ==========================================================
  -- LOCK REQUEST
  -- ==========================================================

  select *
  into request_row
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;


  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'Reschedule request could not be found.';
  end if;


  -- ==========================================================
  -- MUST STILL BE PENDING
  -- ==========================================================

  if request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message =
        'This reschedule request is no longer pending.';
  end if;


  -- ==========================================================
  -- REJECT
  -- ==========================================================

  update public.booking_reschedule_requests

  set
    status = 'rejected',

    rejection_reason =
      nullif(
        trim(p_rejection_reason),
        ''
      ),

    reviewed_by =
      auth.uid(),

    reviewed_at =
      now(),

    updated_at =
      now()

  where id =
        request_row.id;

end;
$$;


revoke all on function
  public.reject_reschedule_request(
    uuid,
    text
  )
from public;

grant execute on function
  public.reject_reschedule_request(
    uuid,
    text
  )
to authenticated;

