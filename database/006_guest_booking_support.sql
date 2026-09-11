alter table reservations

  alter column user_id drop not null,

  add column guest_name text,

  add column guest_phone text;

drop policy if exists "Authenticated users can create their own reservations" on reservations;

create policy "Users can book with account or as guest"

on reservations for insert

to public

with check (

  (auth.uid() = user_id)

  or

  (user_id is null and guest_name is not null and guest_phone is not null)

);