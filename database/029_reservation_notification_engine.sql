/* =========================================================
   029 — RESERVATION NOTIFICATION ENGINE
   PickleReserve

   PAYMENT SOURCE OF TRUTH:
   public.reservations.payment_status

   IMPORTANT:
   The current PickleReserve booking/payment workflow does NOT
   use public.payments. It uses reservations.payment_status.

   Multi-slot protection:
   One booking_reference = one notification.
========================================================= */


-- =========================================================
-- 1. PAYMENT SUBMITTED — ADMIN NOTIFICATION
-- =========================================================

create or replace function public.notify_reservation_payment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  /*
     A booking may contain multiple reservation rows.

     Example:
       PR-2026-00001
         Court 1 / 6:00 PM
         Court 1 / 7:00 PM
         Court 1 / 8:00 PM

     We only create ONE admin notification.
  */

  if new.payment_status = 'pending' then

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

    where p.role = 'admin'

      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p.id
          and n.type = 'payment_submitted'
          and n.booking_reference = new.booking_reference
      );

  end if;

  return new;

end;
$$;


-- =========================================================
-- 2. PAYMENT VERIFIED — CUSTOMER NOTIFICATION
-- =========================================================

create or replace function public.notify_reservation_payment_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_id uuid;
begin

  /*
     Only fire when payment actually changes:

       pending → verified
  */

  if old.payment_status = 'pending'
     and new.payment_status = 'verified' then

    /*
       Find the registered customer using the booking reference.

       This handles multi-slot bookings where several rows
       belong to the same booking.
    */

    select r.user_id
      into customer_id
    from public.reservations r
    where r.booking_reference = new.booking_reference
      and r.user_id is not null
    order by r.created_at asc
    limit 1;


    /*
       Guest bookings have no user_id, therefore no customer
       notification is created.
    */

    if customer_id is not null then

      /*
         Prevent duplicate notification when multiple
         reservation rows are updated at once.
      */

      if not exists (
        select 1
        from public.notifications n
        where n.user_id = customer_id
          and n.type = 'payment_verified'
          and n.booking_reference = new.booking_reference
      ) then

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

  end if;

  return new;

end;
$$;


-- =========================================================
-- 3. PAYMENT REJECTED — CUSTOMER NOTIFICATION
-- =========================================================

create or replace function public.notify_reservation_payment_rejected()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_id uuid;
begin

  /*
     Only fire when payment actually changes:

       pending → rejected
  */

  if old.payment_status = 'pending'
     and new.payment_status = 'rejected' then

    /*
       Find the registered customer using the booking reference.
    */

    select r.user_id
      into customer_id
    from public.reservations r
    where r.booking_reference = new.booking_reference
      and r.user_id is not null
    order by r.created_at asc
    limit 1;


    /*
       Guest bookings have no user_id, therefore no customer
       notification is created.
    */

    if customer_id is not null then

      /*
         Prevent duplicate notification when multiple
         reservation rows are updated at once.
      */

      if not exists (
        select 1
        from public.notifications n
        where n.user_id = customer_id
          and n.type = 'payment_rejected'
          and n.booking_reference = new.booking_reference
      ) then

        perform public.create_notification(
          customer_id,
          'Payment Rejected',
          'Your payment for booking '
            || coalesce(new.booking_reference, 'N/A')
            || ' was rejected.',
          'payment_rejected',
          new.booking_reference
        );

      end if;

    end if;

  end if;

  return new;

end;
$$;


-- =========================================================
-- 4. REMOVE OLD RESERVATION NOTIFICATION TRIGGERS
--    SAFE RE-RUN
-- =========================================================

drop trigger if exists
  trg_notify_reservation_payment_submitted
on public.reservations;

drop trigger if exists
  trg_notify_reservation_payment_verified
on public.reservations;

drop trigger if exists
  trg_notify_reservation_payment_rejected
on public.reservations;


-- =========================================================
-- 5. PAYMENT SUBMITTED TRIGGER
-- =========================================================

create trigger
  trg_notify_reservation_payment_submitted

after insert
on public.reservations

for each row

when (new.payment_status = 'pending')

execute function
  public.notify_reservation_payment_submitted();


-- =========================================================
-- 6. PAYMENT VERIFIED TRIGGER
-- =========================================================

create trigger
  trg_notify_reservation_payment_verified

after update of payment_status
on public.reservations

for each row

when (
  old.payment_status = 'pending'
  and new.payment_status = 'verified'
)

execute function
  public.notify_reservation_payment_verified();


-- =========================================================
-- 7. PAYMENT REJECTED TRIGGER
-- =========================================================

create trigger
  trg_notify_reservation_payment_rejected

after update of payment_status
on public.reservations

for each row

when (
  old.payment_status = 'pending'
  and new.payment_status = 'rejected'
)

execute function
  public.notify_reservation_payment_rejected();


-- =========================================================
-- 8. REMOVE OLD UNUSED PAYMENT TABLE TRIGGERS
--
-- The old 028 engine listened to public.payments.
-- Current PickleReserve does not use that table.
-- =========================================================

drop trigger if exists
  trg_notify_payment_submitted
on public.payments;

drop trigger if exists
  trg_notify_payment_status_change
on public.payments;

drop trigger if exists
  trg_notify_payment_rejected
on public.payments;


-- =========================================================
-- 9. LOCK DOWN TRIGGER FUNCTIONS
-- =========================================================

revoke all on function
  public.notify_reservation_payment_submitted()
from public;

revoke all on function
  public.notify_reservation_payment_verified()
from public;

revoke all on function
  public.notify_reservation_payment_rejected()
from public;


-- =========================================================
-- DONE
-- =========================================================