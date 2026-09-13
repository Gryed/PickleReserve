
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import AdminToast from '../components/AdminToast'
import type { AdminToastType } from '../components/AdminToast'

type ToastData = {
  id: number
  type: AdminToastType
  message: string
}

type AdminToastContextType = {
  showToast: (
    type: AdminToastType,
    message: string,
    duration?: number
  ) => void
  success: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const AdminToastContext =
  createContext<AdminToastContextType | undefined>(undefined)

export function AdminToastProvider({
  children,
}: {
  children: ReactNode
}) {
  const [toast, setToast] = useState<ToastData | null>(null)

  const toastIdRef = useRef(0)
  const toastTimerRef = useRef<number | null>(null)

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }, [])

  const removeToast = useCallback(() => {
    clearToastTimer()
    setToast(null)
  }, [clearToastTimer])

  const showToast = useCallback(
    (
      type: AdminToastType,
      message: string,
      duration = 3500
    ) => {
      clearToastTimer()

      toastIdRef.current += 1

      const id = toastIdRef.current

      setToast({
        id,
        type,
        message,
      })

      if (duration > 0) {
        toastTimerRef.current = window.setTimeout(() => {
          setToast((current) => {
            if (current?.id === id) {
              return null
            }

            return current
          })

          toastTimerRef.current = null
        }, duration)
      }
    },
    [clearToastTimer]
  )

  const success = useCallback(
    (message: string, duration?: number) => {
      showToast('success', message, duration)
    },
    [showToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => {
      showToast('warning', message, duration)
    },
    [showToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => {
      showToast('error', message, duration)
    },
    [showToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => {
      showToast('info', message, duration)
    },
    [showToast]
  )

  useEffect(() => {
    return () => {
      clearToastTimer()
    }
  }, [clearToastTimer])

  return (
    <AdminToastContext.Provider
      value={{
        showToast,
        success,
        warning,
        error,
        info,
      }}
    >
      {children}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col items-end sm:right-6 sm:top-6"
      >
        <div className="pointer-events-auto w-full">
          {toast && (
            <AdminToast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              onClose={removeToast}
            />
          )}
        </div>
      </div>
    </AdminToastContext.Provider>
  )
}

export function useAdminToast() {
  const context = useContext(AdminToastContext)

  if (!context) {
    throw new Error(
      'useAdminToast must be used inside AdminToastProvider'
    )
  }

  return context
}
