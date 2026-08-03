import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './layout/Layout';
import { Login } from './pages/Login/Login';

export function Dashboard() {
  return <div><h2>Dashboard</h2><p>Overview content goes here.</p></div>;
}

export function PatientList() {
  return <div><h2>Patient List</h2><p>List of patients goes here.</p></div>;
}

export function PatientForm({ mode }: { mode: 'add' | 'edit' }) {
  return <div><h2>{mode === 'add' ? 'Add' : 'Edit'} Patient</h2><p>Form goes here.</p></div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />
      },
      {
        path: 'patients',
        element: <PatientList />
      },
      {
        path: 'patients/new',
        element: <PatientForm mode="add" />
      },
      {
        path: 'patients/:id/edit',
        element: <PatientForm mode="edit" />
      }
    ]
  }
]);
