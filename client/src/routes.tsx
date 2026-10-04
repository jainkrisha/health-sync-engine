import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RoleGuard } from './context/RBAC';
import { Layout } from './layout/Layout';
import { Login } from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PatientList from './pages/PatientList/PatientList';
import PatientForm from './pages/PatientForm/PatientForm';
import PatientDetail from './pages/PatientDetail/PatientDetail';
import ConflictDashboard from './pages/ConflictDashboard/ConflictDashboard';
import AuditTrail from './pages/AuditTrail/AuditTrail';
import Admin from './pages/Admin/Admin';
import PhcLibrary from './pages/Phcs/PhcLibrary';
import NotFound from './pages/NotFound';
import { AUDIT_ROLES, PORTAL_ROLES, REVIEW_ROLES, WRITE_ROLES } from '@shared/types';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
}

export const router = createBrowserRouter([
  { path: '/', element: <LoginRoute /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'patients', element: <PatientList /> },
      {
        path: 'patients/new',
        element: (
          <RoleGuard allow={WRITE_ROLES} fallback="redirect">
            <PatientForm mode="add" />
          </RoleGuard>
        ),
      },
      { path: 'patients/:id', element: <PatientDetail /> },
      {
        path: 'patients/:id/edit',
        element: (
          <RoleGuard allow={WRITE_ROLES} fallback="redirect">
            <PatientForm mode="edit" />
          </RoleGuard>
        ),
      },
      {
        path: 'conflicts',
        element: (
          <RoleGuard allow={REVIEW_ROLES} fallback="redirect">
            <ConflictDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'audit',
        element: (
          <RoleGuard allow={AUDIT_ROLES} fallback="redirect">
            <AuditTrail />
          </RoleGuard>
        ),
      },
      {
        path: 'phcs',
        element: (
          <RoleGuard allow={PORTAL_ROLES.district} fallback="redirect">
            <PhcLibrary />
          </RoleGuard>
        ),
      },
      {
        path: 'admin',
        element: (
          <RoleGuard allow={['admin']} fallback="redirect">
            <Admin />
          </RoleGuard>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
