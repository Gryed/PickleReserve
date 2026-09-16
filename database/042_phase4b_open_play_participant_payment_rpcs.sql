-- ============================================================
-- PICKLERESERVE
-- PHASE 4B — OPEN PLAY PARTICIPANT + PAYMENT RPC FOUNDATION
-- 042_phase4b_open_play_participant_payment_rpcs.sql
-- ============================================================


-- ============================================================
-- 1. CUSTOMER JOIN OPEN PLAY SESSION
-- ============================================================

create or replace function public.join_open_play_session(
  p_session_id uuid,
  p_participant_name text,
  p_contact_phone text default null
)
returns public.open_play_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.open_play_sessions;
  v_participant public.open_play_participants;
  v_existing public.open_play_participants;
  v_capacity_count integer;
  v_hold_minutes integer := 15;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_session_id is null then
    raise exception 'Session ID is required.';
  end if;

  if p_participant_name is null
     or trim(p_participant_name) = '' then
    raise exception 'Participant name is required.';
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

  if v_session.status <> 'open' then
    raise exception 'This Open Play session is not currently open.';
  end if;


  -- ==========================================================
  -- REGISTRATION WINDOW
  -- ==========================================================

  if v_session.registration_opens_at is not null
     and now() < v_session.registration_opens_at then
    raise exception 'Registration has not opened yet.';
  end if;

  if v_session.registration_closes_at is not null
     and now() >= v_session.registration_closes_at then
    raise exception 'Registration is already closed.';
  end if;


  -- ==========================================================
  -- SESSION MUST STILL BE FUTURE
  -- ==========================================================

  if (
    v_session.session_date
    + v_session.start_time
  ) <= (
    now() at time zone 'Asia/Manila'
  )::timestamp then
    raise exception 'This Open Play session has already started.';
  end if;


  -- ==========================================================
  -- EXPIRE OLD HOLDS FOR THIS SESSION
  -- ==========================================================

  update public.open_play_participants
  set
    status = 'expired',
    updated_at = now()
  where session_id = v_session.id
    and status = 'held'
    and hold_expires_at is not null
    and hold_expires_at <= now();


  -- ==========================================================
  -- DUPLICATE CHECK
  -- ==========================================================

  select *
    into v_existing
  from public.open_play_participants
  where session_id = v_session.id
    and user_id = auth.uid()
  for update;

  if found then

    if v_existing.status in (
      'held',
      'pending',
      'confirmed'
    ) then
      raise exception 'You already joined this Open Play session.';
    end if;

    -- Allow a previously rejected/cancelled/expired participant
    -- to join again.
    update public.open_play_participants
    set
      participant_name = trim(p_participant_name),
      contact_phone = nullif(trim(p_contact_phone), ''),
      status = 'held',
      amount_due = v_session.price_per_player,
      hold_expires_at = now() + make_interval(mins => v_hold_minutes),
      rejection_reason = null,
      cancelled_at = null,
      cancelled_by = null,
      cancellation_reason = null,
      updated_at = now()
    where id = v_existing.id
    returning *
    into v_participant;

    return v_participant;

  end if;


  -- ==========================================================
  -- CAPACITY CHECK
  -- ==========================================================

  select count(*)
    into v_capacity_count
  from public.open_play_participants p
  where p.session_id = v_session.id
    and (
      p.status in ('pending', 'confirmed')
      or (
        p.status = 'held'
        and p.hold_expires_at is not null
        and p.hold_expires_at > now()
      )
    );

  if v_capacity_count >= v_session.capacity then
    raise exception 'Open Play session is already full.';
  end if;


  -- ==========================================================
  -- CREATE PARTICIPANT HOLD
  -- ==========================================================

  insert into public.open_play_participants (
    session_id,
    user_id,
    participant_name,
    contact_phone,
    status,
    amount_due,
    hold_expires_at
  )
  values (
    v_session.id,
    auth.uid(),
    trim(p_participant_name),
    nullif(trim(p_contact_phone), ''),
    'held',
    v_session.price_per_player,
    now() + make_interval(mins => v_hold_minutes)
  )
  returning *
  into v_participant;

  return v_participant;

end;
$$;


-- ============================================================
-- 2. SUBMIT OPEN PLAY PAYMENT
-- ============================================================

create or replace function public.submit_open_play_payment(
  p_participant_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_transaction_reference text default null,
  p_payment_date date default null,
  p_payment_time time default null,
  p_sender_name text default null,
  p_sender_account text default null,
  p_recipient_name text default null,
  p_proof_url text default null,
  p_payment_provider text default null,
  p_provider_transaction_id text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant public.open_play_participants;
  v_payment public.payments;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_participant_id is null then
    raise exception 'Participant ID is required.';
  end if;

  if p_payment_method is null
     or trim(p_payment_method) = '' then
    raise exception 'Payment method is required.';
  end if;

  if p_amount is null
     or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;


  -- ==========================================================
  -- LOCK PARTICIPANT
  -- ==========================================================

  select *
    into v_participant
  from public.open_play_participants
  where id = p_participant_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Open Play participant record not found.';
  end if;


  -- ==========================================================
  -- VALID PARTICIPANT STATUS
  -- ==========================================================

  if v_participant.status not in ('held', 'rejected') then
    raise exception
      'Payment cannot be submitted for the current participant status.';
  end if;


  -- ==========================================================
  -- HOLD EXPIRATION
  -- ==========================================================

  if v_participant.status = 'held'
     and v_participant.hold_expires_at is not null
     and v_participant.hold_expires_at <= now() then

    update public.open_play_participants
    set
      status = 'expired',
      updated_at = now()
    where id = v_participant.id;

    raise exception 'Your payment hold has expired. Please join the session again.';
  end if;


  -- ==========================================================
  -- AMOUNT MUST MATCH
  -- ==========================================================

  if p_amount <> v_participant.amount_due then
    raise exception
      'Payment amount must match the amount due: %.',
      v_participant.amount_due;
  end if;


  -- ==========================================================
  -- PREVENT MULTIPLE ACTIVE PAYMENTS
  -- ==========================================================

  if exists (
    select 1
    from public.payments p
    where p.open_play_participant_id = v_participant.id
      and p.status = 'pending'
  ) then
    raise exception 'A payment is already pending for this Open Play participant.';
  end if;


  -- ==========================================================
  -- CREATE PAYMENT
  -- ==========================================================

  insert into public.payments (
    booking_reference,
    payment_method,
    amount,
    transaction_reference,
    payment_date,
    payment_time,
    sender_name,
    sender_account,
    recipient_name,
    proof_url,
    status,
    payment_provider,
    provider_transaction_id,
    provider_status,
    submitted_at,
    updated_at,
    open_play_participant_id
  )
  values (
    null,
    trim(p_payment_method),
    p_amount,
    nullif(trim(p_transaction_reference), ''),
    p_payment_date,
    p_payment_time,
    nullif(trim(p_sender_name), ''),
    nullif(trim(p_sender_account), ''),
    nullif(trim(p_recipient_name), ''),
    nullif(trim(p_proof_url), ''),
    'pending',
    nullif(trim(p_payment_provider), ''),
    nullif(trim(p_provider_transaction_id), ''),
    null,
    now(),
    now(),
    v_participant.id
  )
  returning *
  into v_payment;


  -- ==========================================================
  -- PARTICIPANT → PENDING
  -- ==========================================================

  update public.open_play_participants
  set
    status = 'pending',
    hold_expires_at = null,
    rejection_reason = null,
    updated_at = now()
  where id = v_participant.id;

  return v_payment;

end;
$$;


-- ============================================================
-- 3. ADMIN VERIFY OPEN PLAY PAYMENT
-- ============================================================

create or replace function public.admin_verify_open_play_payment(
  p_payment_id uuid
)
returns public.open_play_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_participant public.open_play_participants;
  v_session public.open_play_sessions;
begin

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
  -- LOCK PAYMENT
  -- ==========================================================

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and open_play_participant_id is not null
  for update;

  if not found then
    raise exception 'Open Play payment not found.';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Only pending Open Play payments can be verified.';
  end if;


  -- ==========================================================
  -- LOCK PARTICIPANT
  -- ==========================================================

  select *
    into v_participant
  from public.open_play_participants
  where id = v_payment.open_play_participant_id
  for update;

  if not found then
    raise exception 'Open Play participant not found.';
  end if;

  if v_participant.status <> 'pending' then
    raise exception 'Participant is not awaiting payment verification.';
  end if;


  -- ==========================================================
  -- LOCK SESSION
  -- ==========================================================

  select *
    into v_session
  from public.open_play_sessions
  where id = v_participant.session_id
  for update;

  if not found then
    raise exception 'Open Play session not found.';
  end if;

  if v_session.status in ('cancelled', 'completed') then
    raise exception 'This Open Play session is no longer active.';
  end if;


  -- ==========================================================
  -- VERIFY PAYMENT
  -- ==========================================================

  update public.payments
  set
    status = 'verified',
    verified_at = now(),
    verified_by = auth.uid(),
    rejected_at = null,
    rejected_by = null,
    rejection_reason = null,
    updated_at = now()
  where id = v_payment.id;


  -- ==========================================================
  -- PARTICIPANT → CONFIRMED
  -- ==========================================================

  update public.open_play_participants
  set
    status = 'confirmed',
    updated_at = now()
  where id = v_participant.id
  returning *
  into v_participant;

  return v_participant;

end;
$$;


-- ============================================================
-- 4. ADMIN REJECT OPEN PLAY PAYMENT
-- ============================================================

create or replace function public.admin_reject_open_play_payment(
  p_payment_id uuid,
  p_rejection_reason text default null
)
returns public.open_play_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_participant public.open_play_participants;
begin

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
  -- LOCK PAYMENT
  -- ==========================================================

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and open_play_participant_id is not null
  for update;

  if not found then
    raise exception 'Open Play payment not found.';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Only pending Open Play payments can be rejected.';
  end if;


  -- ==========================================================
  -- LOCK PARTICIPANT
  -- ==========================================================

  select *
    into v_participant
  from public.open_play_participants
  where id = v_payment.open_play_participant_id
  for update;

  if not found then
    raise exception 'Open Play participant not found.';
  end if;

  if v_participant.status <> 'pending' then
    raise exception 'Participant is not awaiting payment verification.';
  end if;


  -- ==========================================================
  -- REJECT PAYMENT
  -- ==========================================================

  update public.payments
  set
    status = 'rejected',
    rejected_at = now(),
    rejected_by = auth.uid(),
    rejection_reason =
      nullif(trim(p_rejection_reason), ''),
    verified_at = null,
    verified_by = null,
    updated_at = now()
  where id = v_payment.id;


  -- ==========================================================
  -- PARTICIPANT → REJECTED
  -- ==========================================================

  update public.open_play_participants
  set
    status = 'rejected',
    rejection_reason =
      nullif(trim(p_rejection_reason), ''),
    updated_at = now()
  where id = v_participant.id
  returning *
  into v_participant;

  return v_participant;

end;
$$;


-- ============================================================
-- 5. CUSTOMER CANCEL OPEN PLAY PARTICIPATION
-- ============================================================

create or replace function public.cancel_open_play_participation(
  p_participant_id uuid,
  p_cancellation_reason text default null
)
returns public.open_play_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant public.open_play_participants;
  v_session public.open_play_sessions;
  v_start_at timestamp;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;


  -- ==========================================================
  -- LOCK PARTICIPANT
  -- ==========================================================

  select *
    into v_participant
  from public.open_play_participants
  where id = p_participant_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Open Play participant record not found.';
  end if;

  if v_participant.status not in (
    'held',
    'pending',
    'confirmed'
  ) then
    raise exception 'This participation cannot be cancelled.';
  end if;


  -- ==========================================================
  -- LOCK SESSION
  -- ==========================================================

  select *
    into v_session
  from public.open_play_sessions
  where id = v_participant.session_id
  for update;

  if not found then
    raise exception 'Open Play session not found.';
  end if;


  -- ==========================================================
  -- 24-HOUR CUTOFF
  -- ==========================================================

  v_start_at :=
    (
      v_session.session_date
      + v_session.start_time
    );

  if now() >= (
    v_start_at
    at time zone 'Asia/Manila'
  ) - interval '24 hours' then
    raise exception
      'Open Play cancellation is only allowed at least 24 hours before the session.';
  end if;


  -- ==========================================================
  -- CANCEL PARTICIPATION
  -- ==========================================================

  update public.open_play_participants
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason =
      nullif(trim(p_cancellation_reason), ''),
    updated_at = now()
  where id = v_participant.id
  returning *
  into v_participant;

  return v_participant;

end;
$$;


-- ============================================================
-- 6. LOCK DOWN EXECUTION
-- ============================================================


revoke all on function public.join_open_play_session(
  uuid,
  text,
  text
) from public, anon;

grant execute on function public.join_open_play_session(
  uuid,
  text,
  text
) to authenticated;


revoke all on function public.submit_open_play_payment(
  uuid,
  text,
  numeric,
  text,
  date,
  time,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.submit_open_play_payment(
  uuid,
  text,
  numeric,
  text,
  date,
  time,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;


revoke all on function public.admin_verify_open_play_payment(
  uuid
) from public, anon;

grant execute on function public.admin_verify_open_play_payment(
  uuid
) to authenticated;


revoke all on function public.admin_reject_open_play_payment(
  uuid,
  text
) from public, anon;

grant execute on function public.admin_reject_open_play_payment(
  uuid,
  text
) to authenticated;


revoke all on function public.cancel_open_play_participation(
  uuid,
  text
) from public, anon;

grant execute on function public.cancel_open_play_participation(
  uuid,
  text
) to authenticated;


-- ============================================================
-- 042 COMPLETE
-- ============================================================