import { supabase } from '../lib/supabase'

export type NotificationType =
  | 'payment_submitted'
  | 'payment_verified'
  | 'payment_rejected'
  | 'booking_reminder'
  | 'booking_update'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'new_booking'
  | 'pending_payment'
  | 'upcoming_reservation'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  booking_reference: string | null
  is_read: boolean
  created_at: string
}

/* =========================================================
   GET NOTIFICATIONS
========================================================= */

export async function getNotifications(
  userId: string
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Error fetching notifications:',
      error
    )

    throw error
  }

  return data ?? []
}

/* =========================================================
   GET UNREAD COUNT
========================================================= */

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error(
      'Error fetching unread notification count:',
      error
    )

    throw error
  }

  return count ?? 0
}

/* =========================================================
   MARK ONE AS READ
========================================================= */

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    'mark_notification_read',
    {
      p_notification_id: notificationId,
    }
  )

  if (error) {
    console.error(
      'Error marking notification as read:',
      error
    )

    throw error
  }
}

/* =========================================================
   MARK ALL AS READ
========================================================= */

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc(
    'mark_all_notifications_read'
  )

  if (error) {
    console.error(
      'Error marking all notifications as read:',
      error
    )

    throw error
  }
}

/* =========================================================
   REALTIME SUBSCRIPTION
========================================================= */

export function subscribeToNotifications(
  userId: string,
  onNotification: (
    notification: Notification
  ) => void
) {
  const channelName =
    `notifications:${userId}:${crypto.randomUUID()}`

  const channel =
    supabase.channel(channelName)

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      onNotification(
        payload.new as Notification
      )
    }
  )

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(
        'Notification realtime connected:',
        userId
      )
    }

    if (status === 'CHANNEL_ERROR') {
      console.error(
        'Notification realtime channel error'
      )
    }

    if (status === 'TIMED_OUT') {
      console.error(
        'Notification realtime connection timed out'
      )
    }
  })

  return () => {
    supabase.removeChannel(channel)
  }
}