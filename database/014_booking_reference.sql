create sequence if not exists booking_ref_seq start 1;

alter table reservations add column booking_reference text;

create or replace function public.generate_booking_reference()

returns text as $$

declare

  next_val int;

begin

  next_val := nextval('booking_ref_seq');

  return 'PR-' || extract(year from now())::text || '-' || lpad(next_val::text, 5, '0');

end;

$$ language plpgsql security definer;

grant execute on function public.generate_booking_reference() to anon, authenticated;