-- ============================================================
-- PickleReserve
-- Migration 027: Notifications
-- ============================================================

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,
  message text not null,

  type text not null
    check (
      type in (
        'payment_submitted',
        'payment_verified',
        'payment_rejected',
        'booking_reminder',
        'booking_update',
        'new_booking',
        'pending_payment',
        'upcoming_reservation'
      )
    ),

  booking_reference text null,

  is_read boolean not null default false,

  created_at timestamptz not null default now()
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

create index if not exists notifications_user_id_idx
  on public.notifications(user_id);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read)
  where is_read = false;

create index if not exists notifications_created_at_idx
  on public.notifications(created_at desc);

create index if not exists notifications_booking_reference_idx
  on public.notifications(booking_reference);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table public.notifications enable row level security;


-- ============================================================
-- 4. CUSTOMER / USER POLICIES
-- ============================================================

drop policy if exists "Users can view own notifications"
on public.notifications;

create policy "Users can view own notifications"
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);


drop policy if exists "Users can update own notifications"
on public.notifications;

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 5. INSERT POLICY
-- ============================================================
-- Notification creation should normally happen through
-- SECURITY DEFINER functions/triggers.
--
-- Direct client inserts are intentionally NOT allowed.


drop policy if exists "Users cannot insert notifications"
on public.notifications;


-- ============================================================
-- 6. DELETE POLICY
-- ============================================================
-- Notifications are system-generated.
-- Users cannot delete them directly.


drop policy if exists "Users cannot delete notifications"
on public.notifications;


-- ============================================================
-- 7. REALTIME
-- ============================================================
-- Allows the frontend to receive new notifications without
-- refreshing the page.

alter table public.notifications replica identity full;

do $$
begin

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then

    alter publication supabase_realtime
      add table public.notifications;

  end if;

end;
$$;


-- ============================================================
-- 8. MARK SINGLE NOTIFICATION AS READ
-- ============================================================

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if auth.uid() is null then
    raise exception using
      errcode = 'P0001',
      message = 'Authentication required.';
  end if;

  update public.notifications
  set is_read = true
  where id = p_notification_id
    and user_id = auth.uid();

end;
$$;


-- ============================================================
-- 9. MARK ALL NOTIFICATIONS AS READ
-- ============================================================

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  if auth.uid() is null then
    raise exception using
      errcode = 'P0001',
      message = 'Authentication required.';
  end if;

  update public.notifications
  set is_read = true
  where user_id = auth.uid()
    and is_read = false;

end;
$$;


-- ============================================================
-- 10. FUNCTION PERMISSIONS
-- ============================================================

revoke all
on function public.mark_notification_read(uuid)
from public;

grant execute
on function public.mark_notification_read(uuid)
to authenticated;


revoke all
on function public.mark_all_notifications_read()
from public;

grant execute
on function public.mark_all_notifications_read()
to authenticated;


-- ============================================================
-- 11. DOCUMENTATION
-- ============================================================

comment on table public.notifications is
'System notifications for PickleReserve customers and staff.';

comment on column public.notifications.user_id is
'Authenticated Supabase user receiving the notification.';

comment on column public.notifications.booking_reference is
'Optional booking reference associated with the notification.';

comment on column public.notifications.is_read is
'False until the recipient reads the notification.';