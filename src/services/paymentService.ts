import { supabase } from '../lib/supabase'

export async function uploadPaymentProof(file: File, idPrefix: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${idPrefix}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('payment-proofs').getPublicUrl(fileName)
  return data.publicUrl
}

export async function updateReservationPaymentProof(
  reservationId: string,
  proofUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ payment_proof_url: proofUrl })
    .eq('id', reservationId)

  if (error) throw error
}

export async function updatePaymentStatus(
  reservationId: string,
  status: 'verified' | 'rejected'
): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ payment_status: status })
    .eq('id', reservationId)

  if (error) throw error
}

export async function getPendingPayments() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, courts(name)')
    .eq('payment_status', 'pending')
    .not('payment_proof_url', 'is', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}