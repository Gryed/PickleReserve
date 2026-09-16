import { supabase } from '../lib/supabase'
import type {
  CancelOpenPlayParticipationInput,
  CreateOpenPlaySessionInput,
  JoinOpenPlayInput,
  OpenPlayParticipant,
  OpenPlayPayment,
  OpenPlaySession,
  OpenPlaySessionPublic,
  SubmitOpenPlayPaymentInput,
  UpdateOpenPlaySessionInput,
} from '../types/openPlay'

// ============================================================
// PUBLIC — OPEN PLAY DISCOVERY
// ============================================================

export async function getOpenPlaySessions(): Promise<
  OpenPlaySessionPublic[]
> {
  const { data, error } = await supabase.rpc(
    'get_public_open_play_sessions',
  )

  if (error) {
    console.error(
      'Error fetching Open Play sessions:',
      error,
    )
    throw error
  }

  return (data ?? []) as OpenPlaySessionPublic[]
}

export async function getOpenPlaySession(
  sessionId: string,
): Promise<OpenPlaySessionPublic | null> {
  const { data, error } = await supabase.rpc(
    'get_public_open_play_session',
    {
      p_session_id: sessionId,
    },
  )

  if (error) {
    console.error(
      'Error fetching Open Play session:',
      error,
    )
    throw error
  }

  if (!data || data.length === 0) {
    return null
  }

  return data[0] as OpenPlaySessionPublic
}
// ADMIN — SESSION LIST
export async function getAdminOpenPlaySessions(): Promise<OpenPlaySession[]> {
  const { data, error } = await supabase
    .from('open_play_sessions')
    .select('*')
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching admin Open Play sessions:', error)
    throw error
  }

  return (data ?? []) as OpenPlaySession[]
}
// ============================================================
// ADMIN — SESSION MANAGEMENT
// ============================================================

export async function createOpenPlaySession(
  input: CreateOpenPlaySessionInput,
): Promise<OpenPlaySession> {
  const { data, error } = await supabase.rpc(
    'admin_create_open_play_session',
    {
      p_session_reference: input.session_reference,
      p_title: input.title,
      p_court_id: input.court_id,
      p_session_date: input.session_date,
      p_start_time: input.start_time,
      p_end_time: input.end_time,
      p_price_per_player: input.price_per_player,
      p_capacity: input.capacity,
      p_description: input.description ?? null,
      p_rules: input.rules ?? null,
      p_registration_opens_at:
        input.registration_opens_at ?? null,
      p_registration_closes_at:
        input.registration_closes_at ?? null,
    },
  )

  if (error) {
    console.error(
      'Error creating Open Play session:',
      error,
    )
    throw error
  }

  return data as OpenPlaySession
}

export async function updateOpenPlaySession(
  input: UpdateOpenPlaySessionInput,
): Promise<OpenPlaySession> {
  const { data, error } = await supabase.rpc(
    'admin_update_open_play_session',
    {
      p_session_id: input.id,
      p_title: input.title,
      p_court_id: input.court_id,
      p_session_date: input.session_date,
      p_start_time: input.start_time,
      p_end_time: input.end_time,
      p_price_per_player: input.price_per_player,
      p_capacity: input.capacity,
      p_description: input.description ?? null,
      p_rules: input.rules ?? null,
      p_registration_opens_at:
        input.registration_opens_at ?? null,
      p_registration_closes_at:
        input.registration_closes_at ?? null,
    },
  )

  if (error) {
    console.error(
      'Error updating Open Play session:',
      error,
    )
    throw error
  }

  return data as OpenPlaySession
}

export async function publishOpenPlaySession(
  sessionId: string,
): Promise<OpenPlaySession> {
  const { data, error } = await supabase.rpc(
    'admin_publish_open_play_session',
    {
      p_session_id: sessionId,
    },
  )

  if (error) {
    console.error(
      'Error publishing Open Play session:',
      error,
    )
    throw error
  }

  return data as OpenPlaySession
}

export async function cancelOpenPlaySession(
  sessionId: string,
  cancellationReason?: string | null,
): Promise<OpenPlaySession> {
  const { data, error } = await supabase.rpc(
    'admin_cancel_open_play_session',
    {
      p_session_id: sessionId,
      p_cancellation_reason:
        cancellationReason ?? null,
    },
  )

  if (error) {
    console.error(
      'Error cancelling Open Play session:',
      error,
    )
    throw error
  }

  return data as OpenPlaySession
}

// ============================================================
// CUSTOMER — PARTICIPATION
// ============================================================

export async function joinOpenPlaySession(
  input: JoinOpenPlayInput,
): Promise<OpenPlayParticipant> {
  const { data, error } = await supabase.rpc(
    'join_open_play_session',
    {
      p_session_id: input.session_id,
      p_participant_name:
        input.participant_name,
      p_contact_phone:
        input.contact_phone ?? null,
    },
  )

  if (error) {
    console.error(
      'Error joining Open Play session:',
      error,
    )
    throw error
  }

  return data as OpenPlayParticipant
}

export async function submitOpenPlayPayment(
  input: SubmitOpenPlayPaymentInput,
): Promise<OpenPlayPayment> {
  const { data, error } = await supabase.rpc(
    'submit_open_play_payment',
    {
      p_participant_id:
        input.participant_id,
      p_payment_method:
        input.payment_method,
      p_amount: input.amount,
      p_transaction_reference:
        input.transaction_reference,
      p_payment_date:
        input.payment_date,
      p_payment_time:
        input.payment_time,
      p_sender_name:
        input.sender_name,
      p_sender_account:
        input.sender_account,
      p_recipient_name:
        input.recipient_name,
      p_proof_url:
        input.proof_url,
      p_payment_provider:
        input.payment_provider ?? null,
      p_provider_transaction_id:
        input.provider_transaction_id ?? null,
    },
  )

  if (error) {
    console.error(
      'Error submitting Open Play payment:',
      error,
    )
    throw error
  }

  return data as OpenPlayPayment
}

export async function cancelOpenPlayParticipation(
  input: CancelOpenPlayParticipationInput,
): Promise<OpenPlayParticipant> {
  const { data, error } = await supabase.rpc(
    'cancel_open_play_participation',
    {
      p_participant_id:
        input.participant_id,
      p_cancellation_reason:
        input.cancellation_reason ?? null,
    },
  )

  if (error) {
    console.error(
      'Error cancelling Open Play participation:',
      error,
    )
    throw error
  }

  return data as OpenPlayParticipant
}

// ============================================================
// CUSTOMER — OWN PARTICIPATIONS
// ============================================================

export async function getMyOpenPlayParticipants(): Promise<
  OpenPlayParticipant[]
> {
  const { data, error } = await supabase
    .from('open_play_participants')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Error fetching my Open Play participations:',
      error,
    )
    throw error
  }

  return (data ?? []) as OpenPlayParticipant[]
}

// ============================================================
// ADMIN — PARTICIPANTS
// ============================================================

export async function getOpenPlayParticipants(
  sessionId: string,
): Promise<OpenPlayParticipant[]> {
  const { data, error } = await supabase
    .from('open_play_participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    console.error(
      'Error fetching Open Play participants:',
      error,
    )
    throw error
  }

  return (data ?? []) as OpenPlayParticipant[]
}

// ============================================================
// ADMIN — PAYMENT VERIFICATION
// ============================================================

export async function verifyOpenPlayPayment(
  paymentId: string,
): Promise<OpenPlayPayment> {
  const { data, error } = await supabase.rpc(
    'admin_verify_open_play_payment',
    {
      p_payment_id: paymentId,
    },
  )

  if (error) {
    console.error(
      'Error verifying Open Play payment:',
      error,
    )
    throw error
  }

  return data as OpenPlayPayment
}

export async function rejectOpenPlayPayment(
  paymentId: string,
  rejectionReason?: string | null,
): Promise<OpenPlayPayment> {
  const { data, error } = await supabase.rpc(
    'admin_reject_open_play_payment',
    {
      p_payment_id: paymentId,
      p_rejection_reason:
        rejectionReason ?? null,
    },
  )

  if (error) {
    console.error(
      'Error rejecting Open Play payment:',
      error,
    )
    throw error
  }

  return data as OpenPlayPayment
}