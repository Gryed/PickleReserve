import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type Notification,
} from '../services/notificationService'

interface NotificationBellProps {
  userId: string
}

function formatNotificationTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()

  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getNotificationIcon(
  type: Notification['type']
) {
  switch (type) {
    case 'payment_submitted':
      return '₱'

    case 'payment_verified':
      return '✓'

    case 'payment_rejected':
      return '×'

    case 'new_booking':
      return '▣'

    case 'booking_reminder':
    case 'upcoming_reservation':
      return '◷'

    case 'booking_update':
      return '↻'

    case 'pending_payment':
      return '₱'

    default:
      return '!'
  }
}

export default function NotificationBell({
  userId,
}: NotificationBellProps) {
  const navigate = useNavigate()

  const [notifications, setNotifications] =
    useState<Notification[]>([])

  const [unreadCount, setUnreadCount] = useState(0)

  const [open, setOpen] = useState(false)

  const [loading, setLoading] = useState(true)

  const containerRef =
    useRef<HTMLDivElement>(null)

  /*
  ========================================================
  LOAD NOTIFICATIONS + REALTIME
  ========================================================
  */

  useEffect(() => {
    let mounted = true

    async function loadNotifications() {
      try {
        const [items, unread] =
          await Promise.all([
            getNotifications(userId),
            getUnreadNotificationCount(userId),
          ])

        if (!mounted) return

        setNotifications(items)

        setUnreadCount(unread)
      } catch (error) {
        console.error(
          'Failed to load notifications:',
          error
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadNotifications()

    const unsubscribe =
      subscribeToNotifications(
        userId,
        (notification) => {
          if (!mounted) return

          setNotifications((current) => {
            const exists = current.some(
              (item) =>
                item.id === notification.id
            )

            if (exists) {
              return current
            }

            return [
              notification,
              ...current,
            ]
          })

          setUnreadCount(
            (count) => count + 1
          )
        }
      )

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [userId])

  /*
  ========================================================
  CLOSE DROPDOWN WHEN CLICKING OUTSIDE
  ========================================================
  */

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener(
        'mousedown',
        handleOutsideClick
      )
    }

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
    }
  }, [open])

  /*
  ========================================================
  NOTIFICATION NAVIGATION
  ========================================================
  */

  function navigateFromNotification(
    notification: Notification
  ) {
    const reference =
      notification.booking_reference

    switch (notification.type) {
      /*
      PAYMENT
      */

      case 'payment_submitted':
      case 'pending_payment':
      case 'payment_verified':
      case 'payment_rejected':
        if (reference) {
          navigate(
            `/admin/payments/pending?reference=${encodeURIComponent(
              reference
            )}`
          )
        } else {
          navigate('/admin/payments/pending')
        }
        break

      /*
      BOOKINGS
      */

      case 'new_booking':
      case 'booking_update':
      case 'booking_reminder':
      case 'upcoming_reservation':
        if (reference) {
          navigate(
            `/admin/reservations?reference=${encodeURIComponent(
              reference
            )}`
          )
        } else {
          navigate('/admin/reservations')
        }
        break

      /*
      DEFAULT
      */

      default:
        navigate('/admin')
        break
    }
  }

  /*
  ========================================================
  CLICK NOTIFICATION
  ========================================================
  */

  async function handleNotificationClick(
    notification: Notification
  ) {
    try {
      if (!notification.is_read) {
        await markNotificationRead(
          notification.id
        )

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  is_read: true,
                }
              : item
          )
        )

        setUnreadCount((count) =>
          Math.max(0, count - 1)
        )
      }
    } catch (error) {
      console.error(
        'Failed to mark notification as read:',
        error
      )
    }

    /*
    Close dropdown first
    */

    setOpen(false)

    /*
    Navigate to the related admin page
    */

    navigateFromNotification(
      notification
    )
  }

  /*
  ========================================================
  MARK ALL AS READ
  ========================================================
  */

  async function handleMarkAllRead() {
    if (unreadCount === 0) return

    try {
      await markAllNotificationsRead()

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      )

      setUnreadCount(0)
    } catch (error) {
      console.error(
        'Failed to mark all notifications as read:',
        error
      )
    }
  }

  /*
  ========================================================
  CLEAR NOTIFICATIONS
  ========================================================
  */

  function handleClearNotifications() {
    setNotifications([])
    setUnreadCount(0)
  }

  /*
  ========================================================
  RENDER
  ========================================================
  */

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {/* ==================================================
          BELL BUTTON
      ================================================== */}

      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-lg text-muted transition hover:border-court/40 hover:text-court"
      >
        <span aria-hidden="true">
          🔔
        </span>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-court px-1 text-[9px] font-bold text-[#0D1B36]">
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {/* ==================================================
          NOTIFICATION DROPDOWN
      ================================================== */}

      {open && (
        <div className="absolute right-0 top-12 z-[100] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">

          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Notifications
              </h3>

              <p className="mt-0.5 text-[10px] text-muted">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'All caught up'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={
                    handleClearNotifications
                  }
                  className="text-[10px] font-medium text-muted transition hover:text-red-400"
                >
                  Clear
                </button>
              )}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={
                    handleMarkAllRead
                  }
                  className="text-[10px] font-medium text-court transition hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* ==================================================
              CONTENT
          ================================================== */}

          <div className="max-h-[420px] overflow-y-auto">

            {/* LOADING */}

            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-muted">
                Loading notifications...
              </div>

            ) : notifications.length ===
              0 ? (

              /* EMPTY */

              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-xl">
                  🔔
                </div>

                <p className="text-sm font-medium text-ink">
                  No notifications
                </p>

                <p className="mt-1 text-xs text-muted">
                  You're all caught up.
                </p>
              </div>

            ) : (

              /* NOTIFICATIONS */

              notifications
                .slice(0, 20)
                .map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                    className={
                      'flex w-full gap-3 border-b border-line px-4 py-3 text-left transition last:border-b-0 ' +
                      (
                        notification.is_read
                          ? 'bg-paper hover:bg-surface'
                          : 'bg-court/[0.06] hover:bg-court/[0.10]'
                      )
                    }
                  >

                    {/* ==================================================
                        ICON
                    ================================================== */}

                    <div
                      className={
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ' +
                        (
                          notification.is_read
                            ? 'bg-surface text-muted'
                            : 'bg-court/15 text-court'
                        )
                      }
                    >
                      {getNotificationIcon(
                        notification.type
                      )}
                    </div>

                    {/* ==================================================
                        TEXT
                    ================================================== */}

                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-2">

                        <p
                          className={
                            'text-xs font-semibold ' +
                            (
                              notification.is_read
                                ? 'text-ink'
                                : 'text-court'
                            )
                          }
                        >
                          {notification.title}
                        </p>

                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-court" />
                        )}

                      </div>

                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                        {notification.message}
                      </p>

                      {/* BOOKING REFERENCE */}

                      {notification.booking_reference && (
                        <p className="mt-1 text-[9px] font-medium text-court">
                          {notification.booking_reference}
                        </p>
                      )}

                      {/* TIME */}

                      <p className="mt-1.5 text-[9px] text-muted/70">
                        {formatNotificationTime(
                          notification.created_at
                        )}
                      </p>

                    </div>

                  </button>
                ))
            )}

          </div>
        </div>
      )}
    </div>
  )
}