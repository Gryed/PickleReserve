create policy "Authenticated users can upload payment proofs"

on storage.objects for insert

to authenticated

with check (bucket_id = 'payment-proofs');

create policy "Anyone can view payment proofs"

on storage.objects for select

to public

using (bucket_id = 'payment-proofs');