import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { router } from './routes';
import { BootLoader } from './components/BootLoader';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <BootLoader />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
