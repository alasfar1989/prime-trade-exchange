import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Clock from './pages/Clock';
import Dashboard from './pages/Dashboard';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
    <Routes>
      {/* Public brand-presence site */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Employee time clock — its own session, not the admin login */}
      <Route path="/clock" element={<Clock />} />

      {/* Gated internal dashboard */}
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
