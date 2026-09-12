import type { ReactNode } from 'react'

export type AdminToastType =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'

type AdminToastProps = {
  type: AdminToastType
  message: string
  onClose: () => void
}

const icons: Record<AdminToastType, ReactNode> = {
  success: '✓',
  warning: '⚠',
  error: '!',
  info: 'i',
}

const styles: Record<
  AdminToastType,
  {
    wrapper: string
    icon: string
  }
> = {
  success: {
    wrapper: 'border-green-200 bg-green-50 text-green-900',
    icon: 'bg-green-600 text-white',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'bg-amber-500 text-white',
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: 'bg-red-600 text-white',
  },
  info: {
    wrapper: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: 'bg-blue-600 text-white',
  },
}

export default function AdminToast({
  type,
  message,
  onClose,
}: AdminToastProps) {
  const style = styles[type]

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${style.wrapper}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.icon}`}
      >
        {icons[type]}
      </div>

      <p className="min-w-0 flex-1 pt-1 text-sm font-semibold">
        {message}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="shrink-0 rounded-md px-1.5 py-1 text-lg leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}