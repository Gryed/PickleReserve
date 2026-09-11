-- ============================================================
-- PickleReserve
-- Migration 021: Atomic Payment Approval / Rejection
-- ============================================================

create or replace function public.verify_booking_payment(
  p_booking_reference text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_count integer;
begin

  if p_booking_reference is null
     or trim(p_booking_reference) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'Booking reference is required.';
  end if;

  update public.reservations
  set
    payment_status = 'verified',
    status = 'confirmed'
  where booking_reference = p_booking_reference
    and status = 'confirmed'
    and payment_status = 'pending';

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Booking is no longer pending or could not be found.';
  end if;

end;
$$;


create or replace function public.reject_booking_payment(
  p_booking_reference text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_count integer;
begin

  if p_booking_reference is null
     or trim(p_booking_reference) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'Booking reference is required.';
  end if;

  update public.reservations
  set
    payment_status = 'rejected',
    status = 'cancelled'
  where booking_reference = p_booking_reference
    and status = 'confirmed'
    and payment_status = 'pending';

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Booking is no longer pending or could not be found.';
  end if;

end;
$$;


grant execute on function public.verify_booking_payment(text)
to authenticated;

grant execute on function public.reject_booking_payment(text)
to authenticated;