alter table settings

  add column payment_mode text not null default 'manual' check (payment_mode in ('manual', 'api')),

  add column gcash_qr_url text,

  add column gcash_number text,

  add column deposit_percentage numeric default 50 check (deposit_percentage between 1 and 100);

alter table reservations

  add column payment_type text not null default 'full' check (payment_type in ('full', 'deposit')),

  add column amount_due numeric,

  add column payment_status text not null default 'pending' check (payment_status in ('pending', 'verified', 'rejected')),

  add column payment_proof_url text;