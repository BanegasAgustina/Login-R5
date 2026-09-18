import { USER_TYPES } from './auth/userTypes';
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PetsPage from './pages/PetsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientsPage from './pages/PatientsPage';
import ConsultasPage from './pages/ConsultasPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPetsPage from './pages/admin/AdminPetsPage';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage';
import './App.css';
// Componente principal de la aplicación que configura el enrutamiento y la autenticación.
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />

            <Route
              path="/mascotas"
              element={
                <ProtectedRoute role={USER_TYPES.CLIENT}>
                  <PetsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pacientes"
              element={
                <ProtectedRoute role={USER_TYPES.VET}>
                  <PatientsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/turnos"
              element={
                <ProtectedRoute role={[USER_TYPES.CLIENT, USER_TYPES.VET]}>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/consultas"
              element={
                <ProtectedRoute role={USER_TYPES.VET}>
                  <ConsultasPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* RUTAS ADMINISTRATIVAS */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role={USER_TYPES.ADMIN}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute role={USER_TYPES.ADMIN}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/mascotas"
              element={
                <ProtectedRoute role={USER_TYPES.ADMIN}>
                  <AdminPetsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/turnos"
              element={
                <ProtectedRoute role={USER_TYPES.ADMIN}>
                  <AdminAppointmentsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
