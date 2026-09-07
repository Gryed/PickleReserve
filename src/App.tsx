import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Booking from './pages/Booking'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProtectedRoute from './components/ProtectedRoute'
import CourtManagement from './pages/admin/CourtManagement'
import OperatingHoursPage from './pages/admin/OperatingHours'
import PaymentSettings from './pages/admin/PaymentSettings'
import PendingPayments from './pages/admin/PendingPayments'
import Dashboard from './pages/admin/Dashboard'
import Reports from './pages/admin/Reports'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/booking/:courtId" element={<Booking />} />
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

        <Route path="*" element={<div>404 — Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App