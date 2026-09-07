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
  const [depositPercentage, setDepositPercentage] = useState(50)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await getSettings()
      setSettings(data)
      setGcashNumber(data.gcash_number ?? '')
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
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file)

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
        deposit_percentage: depositPercentage,
      })
      setSettings(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!settings) return <div className="p-8">No settings found.</div>

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Payment Settings</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Payment mode toggle */}
      <div className="bg-gray-50 border rounded-lg p-4 mb-8 flex items-center justify-between">
        <div>
          <p className="font-medium">
            Payment mode: {settings.payment_mode === 'manual' ? 'Manual (screenshot upload)' : 'API (GCash Business)'}
          </p>
          <p className="text-sm text-gray-500">
            Switch to API mode only once GCash Business/Merchant credentials are configured.
          </p>
        </div>
        <button
          onClick={handleTogglePaymentMode}
          className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
            settings.payment_mode === 'api' ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              settings.payment_mode === 'api' ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {settings.payment_mode === 'manual' && (
        <>
          {/* QR code upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">GCash QR Code</label>
            {settings.gcash_qr_url && (
              <img
                src={settings.gcash_qr_url}
                alt="GCash QR"
                className="w-40 h-40 object-contain border rounded mb-2"
              />
            )}
            <input type="file" accept="image/*" onChange={handleQrUpload} disabled={uploadingQr} />
            {uploadingQr && <p className="text-sm text-gray-500">Uploading...</p>}
          </div>

          {/* GCash number + deposit % */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">GCash Number</label>
            <input
              type="text"
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Deposit Percentage</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(Number(e.target.value))}
                className="w-24 border rounded px-3 py-2"
              />
              <span>%</span>
            </div>
          </div>

          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </>
      )}

      {settings.payment_mode === 'api' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          API mode is not yet connected. This will be wired up once GCash Business/Merchant API credentials are provided.
        </div>
      )}
    </div>
  )
}