-- ============================================================
-- 023_booking_reschedule.sql
-- PickleReserve - Booking Reschedule Foundation
-- ============================================================

create table if not exists public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),

  booking_reference text not null,

  -- Original booking schedule
  old_date date not null,
  old_court_id uuid not null references public.courts(id),
  old_start_time time not null,
  old_end_time time not null,

  -- Requested new schedule
  new_date date not null,
  new_court_id uuid not null references public.courts(id),
  new_start_time time not null,
  new_end_time time not null,

  -- Request status
  status text not null default 'pending'
    check (status in (
      'pending',
      'approved',
      'rejected',
      'cancelled'
    )),

  requested_by uuid references auth.users(id),

  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,

  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
  booking_reschedule_requests_reference_idx
on public.booking_reschedule_requests (
  booking_reference
);

create index if not exists
  booking_reschedule_requests_status_idx
on public.booking_reschedule_requests (
  status
);

create index if not exists
  booking_reschedule_requests_new_schedule_idx
on public.booking_reschedule_requests (
  new_court_id,
  new_date,
  new_start_time
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.update_booking_reschedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  booking_reschedule_requests_updated_at
on public.booking_reschedule_requests;

create trigger
  booking_reschedule_requests_updated_at
before update on public.booking_reschedule_requests
for each row
execute function public.update_booking_reschedule_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.booking_reschedule_requests
enable row level security;

-- ============================================================
-- CUSTOMER:
-- Authenticated users can see requests associated with their
-- own booking only.
--
-- Guest bookings will be handled through controlled RPCs.
-- ============================================================

drop policy if exists
  "Customers can view their own reschedule requests"
on public.booking_reschedule_requests;

create policy
  "Customers can view their own reschedule requests"
on public.booking_reschedule_requests
for select
to authenticated
using (
  requested_by = auth.uid()
);

-- ============================================================
-- ADMIN / STAFF
--
-- We intentionally do NOT create broad role policies here yet.
-- Approval/rejection will go through SECURITY DEFINER RPCs,
-- where we can enforce staff authorization centrally.
-- ============================================================

-- ============================================================
-- CREATE RESCHEDULE REQUEST
-- ============================================================

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
  new_request public.booking_reschedule_requests;
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

  /*
    Get one active reservation belonging to the booking reference.
  */

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

  /*
    Prevent multiple pending reschedule requests for the
    same booking reference.
  */

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

  /*
    Prevent requesting the exact same schedule.
  */

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