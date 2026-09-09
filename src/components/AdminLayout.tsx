import type { ReactNode } from 'react'
import AdminNavbar from './AdminNavbar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <AdminNavbar />
      {children}
    </div>
  )
}