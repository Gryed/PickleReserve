-- ============================================================
-- PICKLERESERVE
-- PHASE 4B — OPEN PLAY DB FOUNDATION
-- 040_phase4b_open_play_foundation.sql
-- ============================================================

-- ============================================================
-- 1. OPEN PLAY SESSIONS
-- ============================================================

create table if not exists public.open_play_sessions (
  id uuid primary key default gen_random_uuid(),

  session_reference text not null unique,

  title text not null,

  court_id uuid not null
    references public.courts(id)
    on delete restrict,

  session_date date not null,

  start_time time not null,

  end_time time not null,

  price_per_player numeric not null,

  capacity integer not null,

  status text not null default 'draft',

  description text null,

  rules text null,

  registration_opens_at timestamptz null,

  registration_closes_at timestamptz null,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  cancelled_at timestamptz null,

  cancelled_by uuid null
    references auth.users(id)
    on delete set null,

  cancellation_reason text null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint open_play_sessions_status_check
    check (
      status in (
        'draft',
        'open',
        'closed',
        'cancelled',
        'completed'
      )
    ),

  constraint open_play_sessions_price_check
    check (
      price_per_player >= 0
    ),

  constraint open_play_sessions_capacity_check
    check (
      capacity > 0
    ),

  constraint open_play_sessions_time_check
    check (
      start_time < end_time
    ),

  constraint open_play_sessions_reference_check
    check (
      length(trim(session_reference)) > 0
    )
);


-- ============================================================
-- 2. OPEN PLAY PARTICIPANTS
-- ============================================================

create table if not exists public.open_play_participants (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.open_play_sessions(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  participant_name text not null,

  contact_phone text null,

  status text not null default 'held',

  amount_due numeric not null,

  hold_expires_at timestamptz null,

  rejection_reason text null,

  cancelled_at timestamptz null,

  cancelled_by uuid null
    references auth.users(id)
    on delete set null,

  cancellation_reason text null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint open_play_participants_status_check
    check (
      status in (
        'held',
        'pending',
        'confirmed',
        'rejected',
        'cancelled',
        'expired'
      )
    ),

  constraint open_play_participants_amount_check
    check (
      amount_due >= 0
    ),

  constraint open_play_participants_name_check
    check (
      length(trim(participant_name)) > 0
    ),

  constraint open_play_participants_unique_user
    unique (
      session_id,
      user_id
    )
);


-- ============================================================
-- 3. RESERVATIONS — OPEN PLAY LINKAGE
-- ============================================================

alter table public.reservations
  add column if not exists booking_kind text
    not null default 'private';

alter table public.reservations
  add column if not exists open_play_session_id uuid
    references public.open_play_sessions(id)
    on delete cascade;


-- ============================================================
-- 4. RESERVATION BOOKING KIND CONSTRAINT
-- ============================================================

alter table public.reservations
  drop constraint if exists reservations_booking_kind_check;

alter table public.reservations
  add constraint reservations_booking_kind_check
  check (
    booking_kind in (
      'private',
      'open_play_block'
    )
  );


-- ============================================================
-- 5. OPEN PLAY RESERVATION LINK VALIDATION
-- ============================================================

alter table public.reservations
  drop constraint if exists reservations_open_play_link_check;

alter table public.reservations
  add constraint reservations_open_play_link_check
  check (
    (
      booking_kind = 'private'
      and open_play_session_id is null
    )
    or
    (
      booking_kind = 'open_play_block'
      and open_play_session_id is not null
    )
  );


-- ============================================================
-- 6. PAYMENTS — OPEN PLAY LINKAGE
-- ============================================================

alter table public.payments
  add column if not exists open_play_participant_id uuid
    references public.open_play_participants(id)
    on delete cascade;


-- booking_reference must be nullable for Open Play payments.
alter table public.payments
  alter column booking_reference drop not null;


-- ============================================================
-- 7. PAYMENT TARGET VALIDATION
-- ============================================================

alter table public.payments
  drop constraint if exists payments_target_check;

alter table public.payments
  add constraint payments_target_check
  check (
    (
      booking_reference is not null
      and open_play_participant_id is null
    )
    or
    (
      booking_reference is null
      and open_play_participant_id is not null
    )
  );


-- ============================================================
-- 8. INDEXES
-- ============================================================

create index if not exists
  open_play_sessions_public_listing_idx
on public.open_play_sessions (
  session_date,
  start_time,
  status
);


create index if not exists
  open_play_sessions_court_date_idx
on public.open_play_sessions (
  court_id,
  session_date,
  start_time
);


create index if not exists
  open_play_participants_session_idx
on public.open_play_participants (
  session_id,
  status
);


create index if not exists
  open_play_participants_user_idx
on public.open_play_participants (
  user_id,
  created_at desc
);


create index if not exists
  reservations_open_play_session_idx
on public.reservations (
  open_play_session_id
);


create index if not exists
  payments_open_play_participant_idx
on public.payments (
  open_play_participant_id
);


-- ============================================================
-- 9. RLS — ENABLE FOUNDATION
-- ============================================================

alter table public.open_play_sessions enable row level security;

alter table public.open_play_participants enable row level security;


-- ============================================================
-- 10. PUBLIC SESSION DISCOVERY
--
-- Only OPEN sessions are publicly discoverable.
-- Details and participant data will be controlled separately.
-- ============================================================

drop policy if exists
  "Anyone can view open play sessions"
on public.open_play_sessions;

create policy
  "Anyone can view open play sessions"
on public.open_play_sessions
for select
to public
using (
  status = 'open'
);


-- ============================================================
-- 11. CUSTOMER PARTICIPANT VISIBILITY
-- ============================================================

drop policy if exists
  "Customers can view own open play participation"
on public.open_play_participants;

create policy
  "Customers can view own open play participation"
on public.open_play_participants
for select
to authenticated
using (
  user_id = auth.uid()
);


-- ============================================================
-- 12. NO DIRECT CLIENT MUTATIONS
--
-- INSERT / UPDATE / DELETE will be handled through secure RPCs.
-- ============================================================


-- ============================================================
-- 13. ADMIN SESSION MANAGEMENT
-- ============================================================

drop policy if exists
  "Admins can manage open play sessions"
on public.open_play_sessions;

create policy
  "Admins can manage open play sessions"
on public.open_play_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);


-- ============================================================
-- 14. ADMIN PARTICIPANT MANAGEMENT
-- ============================================================

drop policy if exists
  "Admins can manage open play participants"
on public.open_play_participants;

create policy
  "Admins can manage open play participants"
on public.open_play_participants
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);


-- ============================================================
-- 15. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

create or replace function public.set_open_play_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
  open_play_sessions_updated_at
on public.open_play_sessions;

create trigger
  open_play_sessions_updated_at
before update on public.open_play_sessions
for each row
execute function public.set_open_play_updated_at();


drop trigger if exists
  open_play_participants_updated_at
on public.open_play_participants;

create trigger
  open_play_participants_updated_at
before update on public.open_play_participants
for each row
execute function public.set_open_play_updated_at();


-- ============================================================
-- 16. SECURITY — TRIGGER FUNCTION
-- ============================================================

revoke all on function public.set_open_play_updated_at()
from public, anon, authenticated;


-- ============================================================
-- 040 COMPLETE
-- ============================================================