import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import RoleRoute from './components/RoleRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import UserManagementPage from './pages/admin/UserManagementPage';
import SpringBootDataPage from './pages/admin/SpringBootDataPage';
import StreamManagementPage from './pages/StreamManagementPage';
import StreamTemplatesPage from './pages/admin/StreamTemplatesPage';
import TraineePage from './pages/admin/TraineePage';
import BusinessRequirementsPage from './pages/admin/BusinessRequirementsPage';
import LandingPage from './pages/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              }
            />

            {/* Protected – all logged-in roles */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/streams" element={<StreamManagementPage />} />

                {/* Admin-only routes */}
                <Route element={<RoleRoute roles={['admin']} />}>
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                </Route>

                {/* Manager + Admin + SME routes */}
                <Route element={<RoleRoute roles={['admin', 'manager', 'sme']} />}>
                  <Route path="/admin/stream-templates" element={<StreamTemplatesPage />} />
                </Route>

                {/* Manager + Admin routes */}
                <Route element={<RoleRoute roles={['admin', 'manager']} />}>
                  <Route path="/admin/training-data" element={<SpringBootDataPage />} />
                  <Route path="/admin/business-requirements" element={<BusinessRequirementsPage />} />
                  <Route path="/admin/trainees" element={<TraineePage />} />
                </Route>
              </Route>
            </Route>

            {/* Landing + fallback */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
