import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

// Route guard: sends unauthenticated visitors to the login page.
export function RequireAuth() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
