-- ============================================================
-- PickleReserve
-- Migration 020: Concurrent Booking Protection
-- ============================================================

-- ============================================================
-- 1. HARD DATABASE SLOT PROTECTION
-- ============================================================
-- Pending + verified reservations both block the slot.
-- Cancelled/rejected reservations do not.

create unique index if not exists reservations_active_slot_unique_idx
  on public.reservations (court_id, date, start_time)
  where status = 'confirmed'
    and payment_status in ('pending', 'verified');


-- ============================================================
-- 2. ATOMIC MULTI-SLOT BOOKING
-- ============================================================
-- All selected slots are inserted in ONE transaction.
--
-- If one slot is already taken, the entire booking fails.
-- This prevents partial bookings and concurrent double booking.

create or replace function public.create_booking_atomic(
  p_reservations jsonb
)
returns setof public.reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  requested_user_id uuid;
  item_user_id uuid;
begin

  if p_reservations is null
     or jsonb_typeof(p_reservations) <> 'array'
     or jsonb_array_length(p_reservations) = 0 then

    raise exception using
      errcode = 'P0001',
      message = 'No reservation slots were provided.';

  end if;


  for item in
    select value
    from jsonb_array_elements(p_reservations)
  loop

    item_user_id :=
      nullif(item ->> 'user_id', '')::uuid;


    -- ========================================================
    -- AUTHENTICATED CUSTOMER
    -- ========================================================

    if auth.uid() is not null then

      if item_user_id is not null
         and item_user_id <> auth.uid() then

        raise exception using
          errcode = 'P0001',
          message = 'Invalid booking user.';

      end if;

    else

      -- ======================================================
      -- GUEST CUSTOMER
      -- ======================================================

      if item_user_id is not null then

        raise exception using
          errcode = 'P0001',
          message = 'Guest bookings cannot specify a user account.';

      end if;

      if nullif(trim(item ->> 'guest_name'), '') is null
         or nullif(trim(item ->> 'guest_phone'), '') is null then

        raise exception using
          errcode = 'P0001',
          message = 'Guest name and mobile number are required.';

      end if;

    end if;


    -- ========================================================
    -- CREATE RESERVATION
    -- ========================================================
    -- Status is ALWAYS confirmed.
    -- Payment is ALWAYS pending.
    --
    -- This is intentional:
    --
    -- confirmed + pending
    --        ↓
    -- slot is temporarily locked
    --        ↓
    -- approve → verified/booked
    -- reject  → cancelled/released

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
      (item ->> 'court_id')::uuid,

      item_user_id,

      nullif(
        trim(item ->> 'guest_name'),
        ''
      ),

      nullif(
        trim(item ->> 'guest_phone'),
        ''
      ),

      (item ->> 'date')::date,

      (item ->> 'start_time')::time,

      (item ->> 'end_time')::time,

      'confirmed',

      coalesce(
        item ->> 'payment_type',
        'full'
      ),

      nullif(
        item ->> 'amount_due',
        ''
      )::numeric,

      'pending',

      nullif(
        item ->> 'payment_proof_url',
        ''
      ),

      nullif(
        item ->> 'booking_reference',
        ''
      )

    )
    returning *;

  end loop;


  return;


exception

  when unique_violation then

    raise exception using
      errcode = 'P0001',
      message =
        'One or more selected time slots are no longer available. Please refresh the availability and choose another slot.';

end;
$$;


-- ============================================================
-- 3. ALLOW CUSTOMER BOOKING
-- ============================================================

grant execute on function public.create_booking_atomic(jsonb)
to anon, authenticated;


-- ============================================================
-- 4. DOCUMENTATION
-- ============================================================

comment on index public.reservations_active_slot_unique_idx is
'Prevents concurrent active bookings for the same court/date/start time. Pending and verified reservations both block the slot.';

comment on function public.create_booking_atomic(jsonb) is
'Atomically creates one or more reservation rows. A unique-slot conflict rolls back the entire booking.';