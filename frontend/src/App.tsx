import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { ContractorsPage } from './pages/ContractorsPage';
import { DealsPage } from './pages/DealsPage';
import { useAuth } from './auth/AuthContext';

function DealsRoute() {
  const { user } = useAuth();
  const isLogistOnly = user?.roles.length === 1 && user.roles[0] === 'LOGIST';
  return isLogistOnly ? <Navigate to="/" replace /> : <DealsPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="contractors" element={<ContractorsPage />} />
          <Route path="deals" element={<DealsRoute />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
