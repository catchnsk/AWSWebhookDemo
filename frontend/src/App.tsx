import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ProducerDashboard from './pages/ProducerDashboard'
import SubscriberDashboard from './pages/SubscriberDashboard'

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, userType } = useAuthStore()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (userType && !allowedRoles.includes(userType)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { isAuthenticated, userType } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/producer"
          element={
            <ProtectedRoute allowedRoles={['producer']}>
              <ProducerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscriber"
          element={
            <ProtectedRoute allowedRoles={['subscriber']}>
              <SubscriberDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            isAuthenticated()
              ? <Navigate to={`/${userType}`} replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
