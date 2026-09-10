
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
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
import CreateBooking from './pages/admin/CreateBooking'

function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      {children}

      <Footer />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />

        <Route
          path="/booking"
          element={
            <PublicLayout>
              <Booking />
            </PublicLayout>
          }
        />

        <Route
          path="/my-bookings"
          element={
            <PublicLayout>
              <MyBookings />
            </PublicLayout>
          }
        />

        <Route
          path="/find-booking"
          element={
            <PublicLayout>
              <FindBooking />
            </PublicLayout>
          }
        />

        <Route
          path="/login"
          element={
            <PublicLayout>
              <Login />
            </PublicLayout>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicLayout>
              <Signup />
            </PublicLayout>
          }
        />

        {/* =========================
            ADMIN ROUTES
        ========================== */}

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

        <Route
          path="/admin/create-booking"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CreateBooking />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* =========================
            404
        ========================== */}

        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-muted">
              404 — Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
