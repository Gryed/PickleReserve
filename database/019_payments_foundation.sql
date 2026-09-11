-- ============================================================
-- PickleReserve
-- Migration 019: Payments Foundation
-- Phase 2G - Manual Payment System
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  -- Booking reference shared by all reservation slots
  booking_reference text not null,

  -- Manual payment method
  payment_method text not null
    check (
      payment_method in (
        'gcash',
        'bank_transfer',
        'other'
      )
    ),

  -- Amount being paid
  amount numeric(12,2) not null
    check (amount > 0),

  -- Customer-provided transaction/reference number
  transaction_reference text,

  -- Payment information
  payment_date date,
  payment_time time,

  -- Sender / recipient information
  sender_name text,
  sender_account text,
  recipient_name text,

  -- Uploaded proof
  proof_url text,

  -- Payment workflow
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'verified',
        'rejected'
      )
    ),

  -- Future API payment support
  payment_provider text,

  provider_transaction_id text,

  provider_status text,

  -- Timestamps
  submitted_at timestamptz not null default now(),

  verified_at timestamptz,

  rejected_at timestamptz,

  -- Admin/Cashier rejection reason
  rejection_reason text,

  -- Audit information
  verified_by uuid references auth.users(id),

  rejected_by uuid references auth.users(id),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


-- ============================================================
-- Indexes
-- ============================================================

create index if not exists payments_booking_reference_idx
  on public.payments (booking_reference);

create index if not exists payments_status_idx
  on public.payments (status);

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

create index if not exists payments_transaction_reference_idx
  on public.payments (transaction_reference);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.payments enable row level security;


-- ============================================================
-- CUSTOMER
-- Customers can view payments connected to their own bookings.
-- The application layer will further restrict booking access.
-- ============================================================

drop policy if exists "Customers can view own payments"
on public.payments;

create policy "Customers can view own payments"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.reservations r
    where r.booking_reference = payments.booking_reference
      and r.user_id = auth.uid()
  )
);


-- ============================================================
-- INSERT
-- Authenticated users can submit payment records.
-- ============================================================

drop policy if exists "Authenticated users can create payments"
on public.payments;

create policy "Authenticated users can create payments"
on public.payments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.reservations r
    where r.booking_reference = payments.booking_reference
      and r.user_id = auth.uid()
  )
);


-- ============================================================
-- ADMIN ACCESS
-- Temporary broad admin policy for existing admin system.
-- This will be hardened further in Phase 2I / 2J
-- when the Permission Engine and role-based RLS are implemented.
-- ============================================================

drop policy if exists "Admins can manage payments"
on public.payments;

create policy "Admins can manage payments"
on public.payments
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in (
        'admin',
        'administrator',
        'super_admin',
        'super admin'
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in (
        'admin',
        'administrator',
        'super_admin',
        'super admin'
      )
  )
);


-- ============================================================
-- Updated timestamp trigger
-- ============================================================

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists payments_updated_at
on public.payments;

create trigger payments_updated_at
before update on public.payments
for each row
execute function public.set_payments_updated_at();


-- ============================================================
-- Comments
-- ============================================================

comment on table public.payments is
'PickleReserve payment records for manual and future API payments.';

comment on column public.payments.booking_reference is
'Shared booking reference connecting payment to one or more reservation slots.';

comment on column public.payments.status is
'Payment workflow status: pending, verified, or rejected.';

comment on column public.payments.proof_url is
'Uploaded payment proof URL.';

comment on column public.payments.provider_transaction_id is
'Transaction ID returned by an automatic payment provider/API.';

comment on column public.payments.provider_status is
'Raw payment status returned by an automatic payment provider/API.';