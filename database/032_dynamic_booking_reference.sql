/* =========================================================
   DYNAMIC BOOKING REFERENCE PREFIX
   PickleReserve reusable client configuration
========================================================= */

-- Add configurable booking reference prefix
alter table public.settings
add column if not exists booking_reference_prefix text
not null
default 'AX';

-- Make sure the current client uses AX
update public.settings
set booking_reference_prefix = 'AX'
where id = 1;


/* =========================================================
   VALIDATION
   2–6 uppercase letters/numbers
   Examples:
   AX
   CA
   CB
   ABC
========================================================= */

alter table public.settings
drop constraint if exists settings_booking_reference_prefix_check;

alter table public.settings
add constraint settings_booking_reference_prefix_check
check (
  booking_reference_prefix ~ '^[A-Z0-9]{2,6}$'
);


/* =========================================================
   DYNAMIC BOOKING REFERENCE GENERATOR
========================================================= */

create or replace function public.generate_booking_reference()
returns text
as $$
declare
  next_val int;
  configured_prefix text;
begin

  next_val := nextval('booking_ref_seq');

  select upper(trim(booking_reference_prefix))
  into configured_prefix
  from public.settings
  where id = 1;

  if configured_prefix is null
     or configured_prefix = ''
  then
    configured_prefix := 'AX';
  end if;

  return configured_prefix
    || '-'
    || extract(year from now())::text
    || '-'
    || lpad(next_val::text, 5, '0');

end;
$$
language plpgsql
security definer;


/* =========================================================
   KEEP EXISTING RPC ACCESS
========================================================= */

grant execute
on function public.generate_booking_reference()
to anon, authenticated;