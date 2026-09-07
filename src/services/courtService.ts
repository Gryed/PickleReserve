import { supabase } from '../lib/supabase'
import type { Court, Settings } from '../types/court'

export async function getCourts(): Promise<Court[]> {
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Court[]
}

export async function createCourt(court: Omit<Court, 'id' | 'created_at'>): Promise<Court> {
  const { data, error } = await supabase
    .from('courts')
    .insert(court)
    .select()
    .single()

  if (error) throw error
  return data as Court
}

export async function updateCourt(id: string, updates: Partial<Omit<Court, 'id' | 'created_at'>>): Promise<Court> {
  const { data, error } = await supabase
    .from('courts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Court
}

export async function deleteCourt(id: string): Promise<void> {
  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw error
  return data as Settings
}

export async function updateSettings(updates: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()

  if (error) throw error
  return data as Settings
}