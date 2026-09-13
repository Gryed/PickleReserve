
import { useEffect, useState } from 'react'
import type { Settings } from '../../types/court'
import {
  getSettings,
  updateSettings,
} from '../../services/courtService'
import { supabase } from '../../lib/supabase'
import { useAdminToast } from '../../context/AdminToastContext'

export default function PaymentSettings() {
  const { success, error: showError } = useAdminToast()

  const [settings, setSettings] =
    useState<Settings | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingMode, setTogglingMode] =
    useState(false)
  const [uploadingQr, setUploadingQr] =
    useState(false)

  const [gcashNumber, setGcashNumber] =
    useState('')

  const [gcashName, setGcashName] =
    useState('')

  const [depositPercentage, setDepositPercentage] =
    useState(50)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)

      const data = await getSettings()

      setSettings(data)

      setGcashNumber(
        data.gcash_number ?? ''
      )

      setGcashName(
        data.gcash_name ?? ''
      )

      setDepositPercentage(
        data.deposit_percentage ?? 50
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to load payment settings'
      )
    } finally {
      setLoading(false)
    }
  }

  function validateGcashNumber(
    value: string
  ) {
    const normalized = value.replace(
      /[\s-]/g,
      ''
    )

    if (!normalized) {
      return 'GCash number is required.'
    }

    if (!/^09\d{9}$/.test(normalized)) {
      return 'Please enter a valid 11-digit GCash number starting with 09.'
    }

    return ''
  }

  function validateDepositPercentage(
    value: number
  ) {
    if (
      Number.isNaN(value) ||
      value < 1 ||
      value > 100
    ) {
      return 'Deposit percentage must be between 1% and 100%.'
    }

    return ''
  }

  async function handleTogglePaymentMode() {
    if (!settings || togglingMode) return

    try {
      setTogglingMode(true)

      const newMode =
        settings.payment_mode === 'manual'
          ? 'api'
          : 'manual'

      const updated =
        await updateSettings({
          payment_mode: newMode,
        })

      setSettings(updated)

      success(
        newMode === 'manual'
          ? 'Manual payment mode enabled.'
          : 'API payment mode enabled.'
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to update payment mode'
      )
    } finally {
      setTogglingMode(false)
    }
  }

  async function handleQrUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    /*
     * Validate file before starting upload.
     */

    if (!file.type.startsWith('image/')) {
      showError(
        'Please select an image file for the GCash QR code.'
      )

      e.target.value = ''
      return
    }

    const maxSize =
      5 * 1024 * 1024

    if (file.size > maxSize) {
      showError(
        'QR image must be 5 MB or smaller.'
      )

      e.target.value = ''
      return
    }

    try {
      setUploadingQr(true)

      const extension =
        file.name.split('.').pop()?.toLowerCase() ||
        'png'

      const fileName =
        `gcash-qr-${Date.now()}.${extension}`

      const {
        error: uploadError,
      } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file)

      if (uploadError) {
        throw uploadError
      }

      const {
        data,
      } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)

      if (!data.publicUrl) {
        throw new Error(
          'Failed to generate QR code URL.'
        )
      }

      const updated =
        await updateSettings({
          gcash_qr_url:
            data.publicUrl,
        })

      setSettings(updated)

      success(
        'GCash QR code uploaded successfully.'
      )

      e.target.value = ''
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to upload QR code'
      )
    } finally {
      setUploadingQr(false)
    }
  }

  async function handleSaveDetails() {
    /*
     * Validate first.
     * Do not enter loading state when the
     * submitted values are already invalid.
     */

    const trimmedName =
      gcashName.trim()

    const trimmedNumber =
      gcashNumber.trim()

    const normalizedNumber =
      trimmedNumber.replace(
        /[\s-]/g,
        ''
      )

    if (!trimmedName) {
      showError(
        'GCash account name is required.'
      )
      return
    }

    const numberError =
      validateGcashNumber(
        trimmedNumber
      )

    if (numberError) {
      showError(numberError)
      return
    }

    const depositError =
      validateDepositPercentage(
        depositPercentage
      )

    if (depositError) {
      showError(depositError)
      return
    }

    try {
      setSaving(true)

      const updated =
        await updateSettings({
          gcash_number:
            normalizedNumber,

          gcash_name:
            trimmedName,

          deposit_percentage:
            depositPercentage,
        })

      setSettings(updated)

      setGcashNumber(
        updated.gcash_number ?? ''
      )

      setGcashName(
        updated.gcash_name ?? ''
      )

      setDepositPercentage(
        updated.deposit_percentage ?? 50
      )

      success(
        'Payment details saved successfully.'
      )
    } catch (err) {
      console.error(err)

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to save payment details'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="pr-page">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="pr-card w-full max-w-md p-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper text-court">
              <span className="animate-spin text-lg">
                ↻
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold text-ink">
              Loading payment settings...
            </p>

            <p className="mt-1 text-xs text-muted">
              Please wait while we load your payment configuration.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!settings) {
    return (
      <main className="pr-page">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="pr-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-red-400">
              ⚠
            </div>

            <p className="mt-4 text-sm font-semibold text-ink">
              Payment settings unavailable
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              No payment settings were found.
            </p>

            <button
              type="button"
              onClick={loadSettings}
              className="mt-5 rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-ink transition hover:border-court/30 hover:text-court"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pr-page">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* HEADER */}

        <section className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            <span>Admin</span>

            <span className="text-line">
              /
            </span>

            <span className="text-court">
              Payments
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Payment Settings
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            Configure how customers pay for their
            reservations and how much deposit is required.
          </p>
        </section>

        {/* PAYMENT MODE */}

        <section className="pr-card mb-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-court/10 text-sm text-court">
                ₱
              </div>

              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  Payment Mode
                </h2>

                <p className="mt-0.5 text-xs text-muted">
                  Choose how payment information is collected.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {settings.payment_mode ===
                    'manual'
                      ? 'Manual Payment'
                      : 'API Payment'}
                  </p>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${
                      settings.payment_mode ===
                      'manual'
                        ? 'border-court/20 bg-court/10 text-court'
                        : 'border-blue-400/20 bg-blue-400/10 text-blue-400'
                    }`}
                  >
                    {settings.payment_mode ===
                    'manual'
                      ? 'SCREENSHOT'
                      : 'API'}
                  </span>
                </div>

                <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted">
                  {settings.payment_mode ===
                  'manual'
                    ? 'Customers submit payment through GCash and upload a screenshot as proof.'
                    : 'API mode is selected, but the GCash Business/Merchant integration is not connected yet.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleTogglePaymentMode}
                disabled={togglingMode}
                aria-label="Toggle payment mode"
                aria-pressed={
                  settings.payment_mode ===
                  'api'
                }
                className={`relative h-7 w-14 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  settings.payment_mode ===
                  'api'
                    ? 'border-blue-400/30 bg-blue-400'
                    : 'border-line bg-line'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-[9px] shadow-sm transition-transform ${
                    settings.payment_mode ===
                    'api'
                      ? 'translate-x-7'
                      : ''
                  }`}
                >
                  {togglingMode
                    ? '↻'
                    : ''}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* MANUAL PAYMENT */}

        {settings.payment_mode ===
          'manual' && (
          <>
            {/* QR CODE */}

            <section className="pr-card mb-6 overflow-hidden">
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-sm text-blue-400">
                    QR
                  </div>

                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">
                      GCash QR Code
                    </h2>

                    <p className="mt-0.5 text-xs text-muted">
                      Customers can scan this QR code to pay their deposit.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">

                  {/* QR PREVIEW */}

                  <div className="flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white p-3">
                    {settings.gcash_qr_url ? (
                      <img
                        src={
                          settings.gcash_qr_url
                        }
                        alt="GCash QR code"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="px-4 text-center">
                        <div className="text-3xl text-muted">
                          QR
                        </div>

                        <p className="mt-2 text-[10px] leading-4 text-muted">
                          No QR code uploaded
                        </p>
                      </div>
                    )}
                  </div>

                  {/* UPLOAD */}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {settings.gcash_qr_url
                        ? 'Replace QR code'
                        : 'Upload QR code'}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted">
                      Upload the GCash QR image that customers should use for payment.
                    </p>

                    <label
                      className={`mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-3 text-xs font-semibold transition ${
                        uploadingQr
                          ? 'cursor-not-allowed border-line bg-paper text-muted'
                          : 'border-line bg-paper text-ink hover:border-court/30 hover:text-court'
                      }`}
                    >
                      <span className="mr-2">
                        {uploadingQr
                          ? '↻'
                          : '↑'}
                      </span>

                      {uploadingQr
                        ? 'Uploading...'
                        : 'Choose QR Image'}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleQrUpload
                        }
                        disabled={
                          uploadingQr
                        }
                        className="hidden"
                      />
                    </label>

                    <p className="mt-2 text-[10px] leading-4 text-muted">
                      JPG, PNG, WEBP or other image format. Maximum 5 MB.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ACCOUNT DETAILS */}

            <section className="pr-card mb-6 overflow-hidden">
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-court/10 text-sm text-court">
                    #
                  </div>

                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">
                      GCash Account
                    </h2>

                    <p className="mt-0.5 text-xs text-muted">
                      Payment details shown to customers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">

                {/* NAME */}

                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    GCash Account Name
                  </label>

                  <input
                    type="text"
                    value={gcashName}
                    onChange={(e) =>
                      setGcashName(
                        e.target.value
                      )
                    }
                    placeholder="e.g. Juan Dela Cruz"
                    disabled={saving}
                    className="pr-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* NUMBER */}

                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    GCash Number
                  </label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={gcashNumber}
                    onChange={(e) =>
                      setGcashNumber(
                        e.target.value
                      )
                    }
                    placeholder="09XX XXX XXXX"
                    disabled={saving}
                    className="pr-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="mt-1.5 text-[10px] leading-4 text-muted">
                    Enter an 11-digit Philippine mobile number starting with 09.
                  </p>
                </div>

                {/* DEPOSIT */}

                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Deposit Percentage
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={
                          depositPercentage
                        }
                        onChange={(e) =>
                          setDepositPercentage(
                            Number(
                              e.target.value
                            )
                          )
                        }
                        disabled={saving}
                        className="pr-input w-28 px-3 py-2.5 pr-8 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                        %
                      </span>
                    </div>

                    <span className="text-xs text-muted">
                      required deposit
                    </span>
                  </div>

                  <p className="mt-1.5 text-[10px] leading-4 text-muted">
                    Example: 50% means customers pay half of the reservation total as their deposit.
                  </p>
                </div>

                {/* SAVE */}

                <div className="flex justify-end border-t border-line pt-5">
                  <button
                    type="button"
                    onClick={
                      handleSaveDetails
                    }
                    disabled={saving}
                    className="btn-court flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {saving && (
                      <span className="animate-spin">
                        ↻
                      </span>
                    )}

                    {saving
                      ? 'Saving...'
                      : 'Save Payment Details'}
                  </button>
                </div>
              </div>
            </section>

            {/* PAYMENT FLOW INFO */}

            <section className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-400/10 text-xs text-blue-400">
                  ℹ
                </div>

                <div>
                  <p className="text-xs font-semibold text-ink">
                    Manual payment flow
                  </p>

                  <p className="mt-1 text-[10px] leading-5 text-muted sm:text-xs">
                    Customer books a court, pays the required deposit through GCash, then uploads payment proof. Admin can review the proof from Pending Payments.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* API MODE */}

        {settings.payment_mode ===
          'api' && (
          <section className="pr-card overflow-hidden">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-sm text-blue-400">
                  API
                </div>

                <div>
                  <h2 className="font-display text-base font-semibold text-ink">
                    GCash Business API
                  </h2>

                  <p className="mt-0.5 text-xs text-muted">
                    Automated payment integration
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-sm text-amber-400">
                    ⚠
                  </span>

                  <div>
                    <p className="text-sm font-semibold text-ink">
                      API integration not connected
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted">
                      API mode is currently available as a configuration option, but no GCash Business/Merchant API credentials or payment gateway integration has been connected yet.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Current status
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />

                  <span className="text-xs font-medium text-ink">
                    Awaiting API configuration
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-5 text-muted">
                For now, use Manual Payment mode so customers can submit GCash payment screenshots for admin verification.
              </p>
            </div>
          </section>
        )}

        {/* FOOTER */}

        <footer className="py-6 text-center">
          <p className="text-[10px] text-muted">
            PickleReserve Admin
          </p>
        </footer>
      </div>
    </main>
  )
}
