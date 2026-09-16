-- ============================================================
-- PICKLERESERVE
-- PHASE 4B — OPEN PLAY ADMIN RPC FOUNDATION
-- 041_phase4b_open_play_admin_rpcs.sql
-- ============================================================


-- ============================================================
-- 1. ADMIN CREATE OPEN PLAY SESSION
-- ============================================================

create or replace function public.admin_create_open_play_session(
  p_session_reference text,
  p_title text,
  p_court_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_price_per_player numeric,
  p_capacity integer,
  p_description text default null,
  p_rules text default null,
  p_registration_opens_at timestamptz default null,
  p_registration_closes_at timestamptz default null
)
returns public.open_play_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation_conflict boolean;
  v_session public.open_play_sessions;
begin

  -- ==========================================================
  -- AUTH / ADMIN CHECK
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;


  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if p_session_reference is null
     or trim(p_session_reference) = '' then
    raise exception 'Session reference is required.';
  end if;

  if p_title is null
     or trim(p_title) = '' then
    raise exception 'Session title is required.';
  end if;

  if p_court_id is null then
    raise exception 'Court is required.';
  end if;

  if p_session_date is null then
    raise exception 'Session date is required.';
  end if;

  if p_start_time is null
     or p_end_time is null then
    raise exception 'Session time is required.';
  end if;

  if p_start_time >= p_end_time then
    raise exception 'Invalid session time range.';
  end if;

  -- Open Play follows the existing hourly booking boundary.
  if extract(minute from p_start_time) <> 0
     or extract(second from p_start_time) <> 0
     or extract(minute from p_end_time) <> 0
     or extract(second from p_end_time) <> 0 then
    raise exception 'Open Play sessions must start and end on an exact hour.';
  end if;

  if p_price_per_player is null
     or p_price_per_player < 0 then
    raise exception 'Invalid player price.';
  end if;

  if p_capacity is null
     or p_capacity <= 0 then
    raise exception 'Capacity must be greater than zero.';
  end if;

  if p_registration_opens_at is not null
     and p_registration_closes_at is not null
     and p_registration_opens_at >= p_registration_closes_at then
    raise exception 'Invalid registration window.';
  end if;


  -- ==========================================================
  -- COURT CHECK
  -- ==========================================================

  if not exists (
    select 1
    from public.courts c
    where c.id = p_court_id
      and c.status = 'available'
  ) then
    raise exception 'Selected court is not available.';
  end if;


  -- ==========================================================
  -- REFERENCE DUPLICATE CHECK
  -- ==========================================================

  if exists (
    select 1
    from public.open_play_sessions s
    where lower(trim(s.session_reference))
        = lower(trim(p_session_reference))
  ) then
    raise exception 'Session reference already exists.';
  end if;


  -- ==========================================================
  -- CREATE SESSION
  -- ==========================================================

  insert into public.open_play_sessions (
    session_reference,
    title,
    court_id,
    session_date,
    start_time,
    end_time,
    price_per_player,
    capacity,
    status,
    description,
    rules,
    registration_opens_at,
    registration_closes_at,
    created_by
  )
  values (
    trim(p_session_reference),
    trim(p_title),
    p_court_id,
    p_session_date,
    p_start_time,
    p_end_time,
    p_price_per_player,
    p_capacity,
    'draft',
    nullif(trim(p_description), ''),
    nullif(trim(p_rules), ''),
    p_registration_opens_at,
    p_registration_closes_at,
    auth.uid()
  )
  returning *
  into v_session;

  return v_session;

end;
$$;


-- ============================================================
-- 2. ADMIN UPDATE OPEN PLAY SESSION
-- ============================================================

create or replace function public.admin_update_open_play_session(
  p_session_id uuid,
  p_title text,
  p_court_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_price_per_player numeric,
  p_capacity integer,
  p_description text default null,
  p_rules text default null,
  p_registration_opens_at timestamptz default null,
  p_registration_closes_at timestamptz default null
)
returns public.open_play_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.open_play_sessions;
begin

  -- ==========================================================
  -- AUTH / ADMIN CHECK
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;


  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if p_session_id is null then
    raise exception 'Session ID is required.';
  end if;

  if p_title is null
     or trim(p_title) = '' then
    raise exception 'Session title is required.';
  end if;

  if p_start_time >= p_end_time then
    raise exception 'Invalid session time range.';
  end if;

  if extract(minute from p_start_time) <> 0
     or extract(second from p_start_time) <> 0
     or extract(minute from p_end_time) <> 0
     or extract(second from p_end_time) <> 0 then
    raise exception 'Open Play sessions must start and end on an exact hour.';
  end if;

  if p_price_per_player is null
     or p_price_per_player < 0 then
    raise exception 'Invalid player price.';
  end if;

  if p_capacity is null
     or p_capacity <= 0 then
    raise exception 'Capacity must be greater than zero.';
  end if;

  if p_registration_opens_at is not null
     and p_registration_closes_at is not null
     and p_registration_opens_at >= p_registration_closes_at then
    raise exception 'Invalid registration window.';
  end if;


  -- ==========================================================
  -- LOCK SESSION
  -- ==========================================================

  select *
    into v_session
  from public.open_play_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Open Play session not found.';
  end if;


  -- Don't allow changing a published/cancelled/completed session
  -- through the normal edit RPC.
  if v_session.status <> 'draft' then
    raise exception 'Only draft Open Play sessions can be edited.';
  end if;


  -- ==========================================================
  -- COURT CHECK
  -- ==========================================================

  if not exists (
    select 1
    from public.courts c
    where c.id = p_court_id
      and c.status = 'available'
  ) then
    raise exception 'Selected court is not available.';
  end if;


  -- ==========================================================
  -- UPDATE
  -- ==========================================================

  update public.open_play_sessions
  set
    title = trim(p_title),
    court_id = p_court_id,
    session_date = p_session_date,
    start_time = p_start_time,
    end_time = p_end_time,
    price_per_player = p_price_per_player,
    capacity = p_capacity,
    description = nullif(trim(p_description), ''),
    rules = nullif(trim(p_rules), ''),
    registration_opens_at = p_registration_opens_at,
    registration_closes_at = p_registration_closes_at
  where id = p_session_id
  returning *
  into v_session;

  return v_session;

end;
$$;


-- ============================================================
-- 3. ADMIN CANCEL OPEN PLAY SESSION
-- ============================================================

create or replace function public.admin_cancel_open_play_session(
  p_session_id uuid,
  p_cancellation_reason text default null
)
returns public.open_play_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.open_play_sessions;
begin

  -- ==========================================================
  -- AUTH / ADMIN CHECK
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;


  -- ==========================================================
  -- LOCK SESSION
  -- ==========================================================

  select *
    into v_session
  from public.open_play_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Open Play session not found.';
  end if;

  if v_session.status in ('cancelled', 'completed') then
    raise exception 'Open Play session cannot be cancelled.';
  end if;


  -- ==========================================================
  -- CANCEL
  -- ==========================================================

  update public.open_play_sessions
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason =
      nullif(trim(p_cancellation_reason), '')
  where id = p_session_id
  returning *
  into v_session;

  return v_session;

end;
$$;


-- ============================================================
-- 4. ADMIN PUBLISH OPEN PLAY SESSION
--
-- Publishing creates one reservation blocker per hour.
-- The existing reservations unique active-slot index remains
-- the final conflict boundary.
-- ============================================================

create or replace function public.admin_publish_open_play_session(
  p_session_id uuid
)
returns public.open_play_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.open_play_sessions;
  v_slot time;
  v_next_slot time;
  v_reference text;
begin

  -- ==========================================================
  -- AUTH / ADMIN CHECK
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;


  -- ==========================================================
  -- LOCK SESSION
  -- ==========================================================

  select *
    into v_session
  from public.open_play_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Open Play session not found.';
  end if;

  if v_session.status <> 'draft' then
    raise exception 'Only draft Open Play sessions can be published.';
  end if;


  -- ==========================================================
  -- COURT VALIDATION
  -- ==========================================================

  if not exists (
    select 1
    from public.courts c
    where c.id = v_session.court_id
      and c.status = 'available'
  ) then
    raise exception 'Selected court is not available.';
  end if;


  -- ==========================================================
  -- CONFLICT CHECK
  -- ==========================================================

  v_slot := v_session.start_time;

  while v_slot < v_session.end_time loop

    v_next_slot := v_slot + interval '1 hour';

    if exists (
      select 1
      from public.reservations r
      where r.court_id = v_session.court_id
        and r.date = v_session.session_date
        and r.start_time = v_slot
        and r.status = 'confirmed'
        and r.payment_status in ('pending', 'verified')
    ) then
      raise exception
        'Court has an existing booking conflict at %.',
        v_slot;
    end if;

    v_slot := v_next_slot;

  end loop;


  -- ==========================================================
  -- CREATE RESERVATION BLOCKERS
  -- ==========================================================

  v_slot := v_session.start_time;

  while v_slot < v_session.end_time loop

    v_next_slot := v_slot + interval '1 hour';

    insert into public.reservations (
      court_id,
      user_id,
      guest_name,
      guest_phone,
      date,
      start_time,
      end_time,
      status,
      payment_type,
      amount_due,
      payment_status,
      payment_proof_url,
      booking_reference,
      booking_kind,
      open_play_session_id
    )
    values (
      v_session.court_id,
      null,
      null,
      null,
      v_session.session_date,
      v_slot,
      v_next_slot,
      'confirmed',
      'full',
      0,
      'verified',
      null,
      v_session.session_reference,
      'open_play_block',
      v_session.id
    );

    v_slot := v_next_slot;

  end loop;


  -- ==========================================================
  -- PUBLISH
  -- ==========================================================

  update public.open_play_sessions
  set status = 'open'
  where id = v_session.id
  returning *
  into v_session;

  return v_session;

exception
  when unique_violation then
    raise exception
      'Open Play could not be published because one or more court slots are already occupied.';
end;
$$;


-- ============================================================
-- 5. LOCK DOWN FUNCTION EXECUTION
-- ============================================================

revoke all on function public.admin_create_open_play_session(
  text,
  text,
  uuid,
  date,
  time,
  time,
  numeric,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) from public, anon;

grant execute on function public.admin_create_open_play_session(
  text,
  text,
  uuid,
  date,
  time,
  time,
  numeric,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) to authenticated;


revoke all on function public.admin_update_open_play_session(
  uuid,
  text,
  uuid,
  date,
  time,
  time,
  numeric,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) from public, anon;

grant execute on function public.admin_update_open_play_session(
  uuid,
  text,
  uuid,
  date,
  time,
  time,
  numeric,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) to authenticated;


revoke all on function public.admin_cancel_open_play_session(
  uuid,
  text
) from public, anon;

grant execute on function public.admin_cancel_open_play_session(
  uuid,
  text
) to authenticated;


revoke all on function public.admin_publish_open_play_session(
  uuid
) from public, anon;

grant execute on function public.admin_publish_open_play_session(
  uuid
) to authenticated;


-- ============================================================
-- 041 COMPLETE
-- ============================================================