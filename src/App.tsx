import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import AdminLayout from './components/AdminLayout'
import Home from './pages/Home'
import Booking from './pages/Booking'
import MyBookings from './pages/MyBookings'
import FindBooking from './pages/FindBooking'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/admin/Dashboard'
import CourtManagement from './pages/admin/CourtManagement'
import OperatingHoursPage from './pages/admin/OperatingHours'
import PaymentSettings from './pages/admin/PaymentSettings'
import PendingPayments from './pages/admin/PendingPayments'
import Reservations from './pages/admin/Reservations'
import Reports from './pages/admin/Reports'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><Navbar /><Home /></>} />
        <Route path="/booking/:courtId" element={<><Navbar /><Booking /></>} />
        <Route path="/my-bookings" element={<><Navbar /><MyBookings /></>} />
        <Route path="/find-booking" element={<><Navbar /><FindBooking /></>} />
        <Route path="/login" element={<><Navbar /><Login /></>} />
        <Route path="/signup" element={<><Navbar /><Signup /></>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courts"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CourtManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hours"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <OperatingHoursPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PaymentSettings />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments/pending"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PendingPayments />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reservations"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Reservations />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Reports />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<div className="p-8">404 — Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App