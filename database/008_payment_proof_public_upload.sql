drop policy if exists "Authenticated users can upload payment proofs" on storage.objects;

create policy "Anyone can upload payment proofs"

on storage.objects for insert

to public

with check (bucket_id = 'payment-proofs');