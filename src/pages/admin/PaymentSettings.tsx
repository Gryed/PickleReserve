import { useEffect, useState } from 'react'
import type { Settings } from '../../types/court'
import { getSettings, updateSettings } from '../../services/courtService'
import { supabase } from '../../lib/supabase'

export default function PaymentSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingQr, setUploadingQr] = useState(false)

  const [gcashNumber, setGcashNumber] = useState('')
  const [gcashName, setGcashName] = useState('')
  const [depositPercentage, setDepositPercentage] = useState(50)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await getSettings()
      setSettings(data)
      setGcashNumber(data.gcash_number ?? '')
      setGcashName(data.gcash_name ?? '')
      setDepositPercentage(data.deposit_percentage ?? 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleTogglePaymentMode() {
    if (!settings) return
    try {
      const newMode = settings.payment_mode === 'manual' ? 'api' : 'manual'
      const updated = await updateSettings({ payment_mode: newMode })
      setSettings(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingQr(true)
    setError('')
    try {
      const fileName = `gcash-qr-${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(fileName)
      const updated = await updateSettings({ gcash_qr_url: data.publicUrl })
      setSettings(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload QR code')
    } finally {
      setUploadingQr(false)
    }
  }

  async function handleSaveDetails() {
    setSaving(true)
    setError('')
    try {
      const updated = await updateSettings({
        gcash_number: gcashNumber,
        gcash_name: gcashName,
        deposit_percentage: depositPercentage,
      })
      setSettings(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 max-w-xl mx-auto text-muted">Loading...</div>
  if (!settings) return <div className="p-8 max-w-xl mx-auto text-muted">No settings found.</div>

  return (
    <div className="p-6 sm:p-8 max-w-xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Payment settings</h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="border border-line rounded-lg p-4 mb-8 bg-surface flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            Payment mode: {settings.payment_mode === 'manual' ? 'Manual (screenshot upload)' : 'API (GCash Business)'}
          </p>
          <p className="text-sm text-muted">
            Switch to API mode only once GCash Business/Merchant credentials are configured.
          </p>
        </div>
        <button
          onClick={handleTogglePaymentMode}
          className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
            settings.payment_mode === 'api' ? 'bg-court' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-paper rounded-full transition-transform ${
              settings.payment_mode === 'api' ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {settings.payment_mode === 'manual' && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">GCash QR code</label>
            {settings.gcash_qr_url && (
              <img
                src={settings.gcash_qr_url}
                alt="GCash QR"
                className="w-40 h-40 object-contain border border-line rounded-lg mb-2 bg-white"
              />
            )}
            <input type="file" accept="image/*" onChange={handleQrUpload} disabled={uploadingQr} />
            {uploadingQr && <p className="text-sm text-muted">Uploading...</p>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-muted mb-1">GCash account name</label>
            <input
              type="text"
              value={gcashName}
              onChange={(e) => setGcashName(e.target.value)}
              placeholder="e.g. Juan D."
              className="w-full bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-muted mb-1">GCash number</label>
            <input
              type="text"
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-muted mb-1">Deposit percentage</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(Number(e.target.value))}
                className="w-24 bg-surface border border-line rounded-md px-3 py-2 text-ink focus:outline-none focus:border-court"
              />
              <span className="text-muted">%</span>
            </div>
          </div>

          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="btn-court px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save details'}
          </button>
        </>
      )}

      {settings.payment_mode === 'api' && (
        <div className="bg-court/10 border border-court/30 rounded-lg p-4 text-sm text-muted">
          API mode is not yet connected. This will be wired up once GCash Business/Merchant API credentials are provided.
        </div>
      )}
    </div>
  )
}
