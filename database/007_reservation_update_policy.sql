drop policy if exists "Users can update their own reservations, admins can update any" on reservations;

create policy "Users, guests, and admins can update reservations"

on reservations for update

to public

using (

  auth.uid() = user_id

  or user_id is null

  or auth.uid() is not null

);

grant update on reservations to anon;