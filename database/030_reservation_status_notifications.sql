-- ============================================================
-- 030 RESERVATION STATUS + ADMIN NOTIFICATIONS
-- PickleReserve
--
-- Adds:
--   1. Admin reschedule tracking
--   2. Rescheduled booking lookup RPC
--   3. Cancelled booking notifications
--   4. Rescheduled booking notifications
--   5. Admin payment verified/rejected notifications
-- ============================================================


-- ============================================================
-- 1. ADMIN RESCHEDULE TRACKING
--
-- The existing admin_reschedule_booking() RPC directly
-- changes the reservation rows.
--
-- We use an AFTER UPDATE trigger to create an approved
-- reschedule record for direct admin reschedules.
--
-- Customer-approved reschedules already have a pending
-- request, so they will not create a duplicate marker here.
-- ============================================================

create or replace function public.track_admin_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if (
    old.court_id is distinct from new.court_id
    or old.date is distinct from new.date
    or old.start_time is distinct from new.start_time
    or old.end_time is distinct from new.end_time
  )
  and new.booking_reference is not null
  and new.status = 'confirmed'
  and new.payment_status = 'verified'
  then

    /*
      If an existing pending reschedule request exists,
      this update came from the customer reschedule approval
      workflow.

      The request itself will later become approved.
    */

    if not exists (
      select 1
      from public.booking_reschedule_requests br
      where br.booking_reference =
        new.booking_reference
        and br.status = 'pending'
    )
    and not exists (
      select 1
      from public.booking_reschedule_requests br
      where br.booking_reference =
        new.booking_reference
        and br.status = 'approved'
        and br.updated_at >= now() - interval '5 seconds'
    )
    then

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
        new.booking_reference,

        old.date,
        old.court_id,
        old.start_time,
        old.end_time,

        new.date,
        new.court_id,
        new.start_time,
        new.end_time,

        jsonb_build_array(
          jsonb_build_object(
            'court_id',
            new.court_id,
            'date',
            new.date,
            'start_time',
            new.start_time,
            'end_time',
            new.end_time
          )
        ),

        'approved',
        auth.uid(),
        auth.uid(),
        now()
      );

    end if;

  end if;

  return new;

end;
$$;


drop trigger if exists
  trg_track_admin_reschedule
on public.reservations;


create trigger
  trg_track_admin_reschedule

after update of
  court_id,
  date,
  start_time,
  end_time

on public.reservations

for each row

execute function
  public.track_admin_reschedule();


revoke all on function
  public.track_admin_reschedule()
from public;


-- ============================================================
-- 2. ADMIN RESCHEDULED BOOKING REFERENCES
-- ============================================================

create or replace function
public.get_admin_rescheduled_booking_references()
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_result text[];
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;


  select exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'admin'
  )
  into v_is_admin;


  if not v_is_admin then
    raise exception
      'Only administrators can view rescheduled bookings.';
  end if;


  select coalesce(
    array_agg(
      distinct booking_reference
    ),
    '{}'
  )
  into v_result

  from public.booking_reschedule_requests

  where status = 'approved'
    and booking_reference is not null;


  return v_result;

end;
$$;


revoke all on function
public.get_admin_rescheduled_booking_references()
from public;


grant execute on function
public.get_admin_rescheduled_booking_references()
to authenticated;


-- ============================================================
-- 3. CANCELLED BOOKING NOTIFICATION
-- ============================================================

create or replace function
public.notify_admin_booking_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if old.status = 'confirmed'
     and new.status = 'cancelled'
     and new.booking_reference is not null
  then

    insert into public.notifications (
      user_id,
      title,
      message,
      type,
      booking_reference,
      is_read
    )

    select
      p.id,

      'Booking Cancelled',

      'Booking '
        || new.booking_reference
        || ' has been cancelled.',

      'booking_cancelled',

      new.booking_reference,

      false

    from public.profiles p

    where p.role = 'admin'

      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p.id
          and n.type = 'booking_cancelled'
          and n.booking_reference =
            new.booking_reference
      );

  end if;

  return new;

end;
$$;


drop trigger if exists
  trg_notify_admin_booking_cancelled
on public.reservations;


create trigger
  trg_notify_admin_booking_cancelled

after update of status

on public.reservations

for each row

when (
  old.status = 'confirmed'
  and new.status = 'cancelled'
)

execute function
  public.notify_admin_booking_cancelled();


revoke all on function
public.notify_admin_booking_cancelled()
from public;


-- ============================================================
-- 4. RESCHEDULED BOOKING NOTIFICATION
-- ============================================================

create or replace function
public.notify_admin_booking_rescheduled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if new.status = 'approved'
     and new.booking_reference is not null
  then

    insert into public.notifications (
      user_id,
      title,
      message,
      type,
      booking_reference,
      is_read
    )

    select
      p.id,

      'Booking Rescheduled',

      'Booking '
        || new.booking_reference
        || ' has been rescheduled.',

      'booking_rescheduled',

      new.booking_reference,

      false

    from public.profiles p

    where p.role = 'admin';

  end if;

  return new;

end;
$$;


drop trigger if exists
  trg_notify_admin_booking_rescheduled
on public.booking_reschedule_requests;


create trigger
  trg_notify_admin_booking_rescheduled

after insert or update of status

on public.booking_reschedule_requests

for each row

when (
  new.status = 'approved'
)

execute function
  public.notify_admin_booking_rescheduled();


revoke all on function
public.notify_admin_booking_rescheduled()
from public;


-- ============================================================
-- 5. ADMIN PAYMENT VERIFIED / REJECTED NOTIFICATIONS
-- ============================================================

create or replace function
public.notify_admin_payment_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_message text;
  v_type text;
begin

  if old.payment_status = 'pending'
     and new.payment_status = 'verified'
  then

    v_title :=
      'Payment Verified';

    v_message :=
      'Payment for booking '
      || coalesce(
        new.booking_reference,
        'N/A'
      )
      || ' has been verified.';

    v_type :=
      'payment_verified';

  elsif old.payment_status = 'pending'
        and new.payment_status = 'rejected'
  then

    v_title :=
      'Payment Rejected';

    v_message :=
      'Payment for booking '
      || coalesce(
        new.booking_reference,
        'N/A'
      )
      || ' has been rejected.';

    v_type :=
      'payment_rejected';

  else

    return new;

  end if;


  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    booking_reference,
    is_read
  )

  select
    p.id,
    v_title,
    v_message,
    v_type,
    new.booking_reference,
    false

  from public.profiles p

  where p.role = 'admin'

    and not exists (
      select 1
      from public.notifications n
      where n.user_id = p.id
        and n.type = v_type
        and n.booking_reference =
          new.booking_reference
    );


  return new;

end;
$$;


drop trigger if exists
  trg_notify_admin_payment_result
on public.reservations;


create trigger
  trg_notify_admin_payment_result

after update of payment_status

on public.reservations

for each row

when (
  old.payment_status = 'pending'
  and new.payment_status in (
    'verified',
    'rejected'
  )
)

execute function
  public.notify_admin_payment_result();


revoke all on function
public.notify_admin_payment_result()
from public;


-- ============================================================
-- DONE
-- ============================================================