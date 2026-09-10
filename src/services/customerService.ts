import { supabase } from '../lib/supabase'

export interface CustomerProfile {
  id: string
  username: string
}

export async function searchCustomers(
  searchTerm: string
): Promise<CustomerProfile[]> {
  const term = searchTerm.trim()

  if (!term) {
    return []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('role', 'customer')
    .ilike('username', `%${term}%`)
    .order('username', { ascending: true })
    .limit(10)

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerProfile[]
}