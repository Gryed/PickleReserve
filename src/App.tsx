import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Booking from './pages/Booking'
import MyBookings from './pages/MyBookings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/admin/Dashboard'
import CourtManagement from './pages/admin/CourtManagement'
import OperatingHoursPage from './pages/admin/OperatingHours'
import PaymentSettings from './pages/admin/PaymentSettings'
import PendingPayments from './pages/admin/PendingPayments'
import Reports from './pages/admin/Reports'
import Reservations from './pages/admin/Reservations'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/booking/:courtId" element={<Booking />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courts"
          element={
            <ProtectedRoute>
              <CourtManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hours"
          element={
            <ProtectedRoute>
              <OperatingHoursPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute>
              <PaymentSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments/pending"
          element={
            <ProtectedRoute>
              <PendingPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reservations"
          element={
            <ProtectedRoute>
              <Reservations />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<div className="p-8">404 — Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App