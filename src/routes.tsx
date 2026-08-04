import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './layout/Layout';
import { Login } from './pages/Login/Login';

import Dashboard from './pages/Dashboard/Dashboard';
import PatientList from './pages/PatientList/PatientList';

import PatientForm from './pages/PatientForm/PatientForm';


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
