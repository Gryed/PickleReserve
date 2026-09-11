import { supabase } from '../lib/supabase'
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../types/availability'

export async function uploadPaymentProof(
  file: File,
  idPrefix: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${idPrefix}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(fileName)

  return data.publicUrl
}

/**
 * Create a payment record for a booking.
 */
export async function createPayment(payment: {
  booking_reference: string
  payment_method: PaymentMethod
  amount: number
  transaction_reference?: string | null
  payment_date?: string | null
  payment_time?: string | null
  sender_name?: string | null
  sender_account?: string | null
  recipient_name?: string | null
  proof_url?: string | null
}): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      booking_reference: payment.booking_reference,
      payment_method: payment.payment_method,
      amount: payment.amount,
      transaction_reference: payment.transaction_reference ?? null,
      payment_date: payment.payment_date ?? null,
      payment_time: payment.payment_time ?? null,
      sender_name: payment.sender_name ?? null,
      sender_account: payment.sender_account ?? null,
      recipient_name: payment.recipient_name ?? null,
      proof_url: payment.proof_url ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error

  return data as Payment
}

/**
 * Get payments for a specific booking reference.
 */
export async function getPaymentsByBookingReference(
  bookingReference: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_reference', bookingReference)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as Payment[]
}

/**
 * Get a single payment.
 */
export async function getPaymentById(
  paymentId: string
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (error) throw error

  return data as Payment
}

/**
 * Get pending payments for Admin/Cashier.
 */
export async function getPendingPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as Payment[]
}

/**
 * Update payment status.
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: Extract<PaymentStatus, 'verified' | 'rejected'>,
  rejectionReason?: string | null
): Promise<Payment> {
  const updateData: Record<string, unknown> = {
    status,
  }

  if (status === 'verified') {
    updateData.verified_at = new Date().toISOString()
    updateData.rejected_at = null
    updateData.rejection_reason = null
  }

  if (status === 'rejected') {
    updateData.rejected_at = new Date().toISOString()
    updateData.verified_at = null
    updateData.rejection_reason = rejectionReason ?? null
  }

  const { data, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single()

  if (error) throw error

  return data as Payment
}

/**
 * Verify payment.
 */
export async function verifyPayment(
  paymentId: string
): Promise<Payment> {
  return updatePaymentStatus(paymentId, 'verified')
}

/**
 * Reject payment.
 */
export async function rejectPayment(
  paymentId: string,
  reason?: string
): Promise<Payment> {
  return updatePaymentStatus(paymentId, 'rejected', reason)
}