import { supabase } from '../lib/supabase'

export interface ReportRow {
  id: string
  date: string
  start_time: string
  end_time: string
  court_name: string
  payment_type: string
  amount_due: number | null
  payment_status: string
  status: string
}

export async function getReservationsInRange(
  startDate: string,
  endDate: string
): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, date, start_time, end_time, payment_type, amount_due, payment_status, status, courts(name)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) throw error

  return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    date: r.date as string,
    start_time: r.start_time as string,
    end_time: r.end_time as string,
    court_name: (r.courts as { name: string } | null)?.name ?? 'Unknown',
    payment_type: r.payment_type as string,
    amount_due: r.amount_due as number | null,
    payment_status: r.payment_status as string,
    status: r.status as string,
  }))
}

export function calculateRevenue(rows: ReportRow[]): number {
  return rows
    .filter((r) => r.payment_status === 'verified' && r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.amount_due ?? 0), 0)
}

export function exportToCSV(rows: ReportRow[]): void {
  const headers = ['Date', 'Time', 'Court', 'Payment Type', 'Amount', 'Payment Status', 'Booking Status']
  const csvRows = rows.map((r) => [
    r.date,
    `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`,
    r.court_name,
    r.payment_type,
    r.amount_due ?? '',
    r.payment_status,
    r.status,
  ])

  const csvContent = [headers, ...csvRows].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `picklereserve-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}