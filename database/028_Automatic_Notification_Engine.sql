-- ============================================================
-- PickleReserve
-- Migration 028: Automatic Notification Engine
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTION
-- Create a notification safely.
-- ============================================================

create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_booking_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    booking_reference,
    is_read
  )
  values (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_booking_reference,
    false
  );

end;
$$;


-- ============================================================
-- 2. PAYMENT SUBMITTED
-- Notify all administrators when a new pending payment
-- is submitted.
-- ============================================================

create or replace function public.notify_payment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if new.status = 'pending' then

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
      'New Payment Submitted',
      'A payment has been submitted for booking '
        || coalesce(new.booking_reference, 'N/A')
        || ' and is waiting for verification.',
      'payment_submitted',
      new.booking_reference,
      false
    from public.profiles p
    where p.role = 'admin';

  end if;

  return new;

end;
$$;


-- ============================================================
-- 3. PAYMENT VERIFIED
-- Notify the customer linked to the booking.
-- ============================================================

create or replace function public.notify_payment_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_id uuid;
begin

  if old.status <> 'verified'
     and new.status = 'verified' then

    select r.user_id
    into customer_id
    from public.reservations r
    where r.booking_reference = new.booking_reference
      and r.user_id is not null
    limit 1;

    if customer_id is not null then

      perform public.create_notification(
        customer_id,
        'Payment Verified',
        'Your payment for booking '
          || coalesce(new.booking_reference, 'N/A')
          || ' has been verified. Your reservation is confirmed.',
        'payment_verified',
        new.booking_reference
      );

    end if;

  end if;

  return new;

end;
$$;


-- ============================================================
-- 4. PAYMENT REJECTED
-- Notify the customer linked to the booking.
-- ============================================================

create or replace function public.notify_payment_rejected()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_id uuid;
  rejection_message text;
begin

  if old.status <> 'rejected'
     and new.status = 'rejected' then

    select r.user_id
    into customer_id
    from public.reservations r
    where r.booking_reference = new.booking_reference
      and r.user_id is not null
    limit 1;

    rejection_message :=
      'Your payment for booking '
      || coalesce(new.booking_reference, 'N/A')
      || ' was rejected.';

    if new.rejection_reason is not null
       and trim(new.rejection_reason) <> '' then

      rejection_message :=
        rejection_message
        || ' Reason: '
        || new.rejection_reason;

    end if;

    if customer_id is not null then

      perform public.create_notification(
        customer_id,
        'Payment Rejected',
        rejection_message,
        'payment_rejected',
        new.booking_reference
      );

    end if;

  end if;

  return new;

end;
$$;


-- ============================================================
-- 5. TRIGGER: PAYMENT INSERT
-- ============================================================

drop trigger if exists
  trg_notify_payment_submitted
on public.payments;

create trigger
  trg_notify_payment_submitted
after insert
on public.payments
for each row
execute function public.notify_payment_submitted();


-- ============================================================
-- 6. TRIGGER: PAYMENT STATUS CHANGE
-- ============================================================

drop trigger if exists
  trg_notify_payment_status_change
on public.payments;

create trigger
  trg_notify_payment_status_change
after update of status
on public.payments
for each row
execute function public.notify_payment_verified();


-- ============================================================
-- 7. SEPARATE REJECTION TRIGGER
-- ============================================================

drop trigger if exists
  trg_notify_payment_rejected
on public.payments;

create trigger
  trg_notify_payment_rejected
after update of status
on public.payments
for each row
execute function public.notify_payment_rejected();


-- ============================================================
-- 8. PERMISSIONS
-- ============================================================

revoke all on function public.create_notification(
  uuid,
  text,
  text,
  text,
  text
) from public;

revoke all on function public.notify_payment_submitted()
from public;

revoke all on function public.notify_payment_verified()
from public;

revoke all on function public.notify_payment_rejected()
from public;


-- ============================================================
-- 9. COMMENTS
-- ============================================================

comment on function public.create_notification(
  uuid,
  text,
  text,
  text,
  text
) is
'Internal helper used by the notification engine to create user notifications.';

comment on function public.notify_payment_submitted() is
'Automatically notifies all admin users when a pending payment is submitted.';

comment on function public.notify_payment_verified() is
'Automatically notifies the customer when a payment becomes verified.';

comment on function public.notify_payment_rejected() is
'Automatically notifies the customer when a payment becomes rejected.';