import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { AdminToastProvider } from './context/AdminToastContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AdminToastProvider>
        <App />
      </AdminToastProvider>
    </AuthProvider>
  </StrictMode>,
)