import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { ContractorsPage } from './pages/ContractorsPage';
import { LeadsPage } from './pages/LeadsPage';
import { DealsPage } from './pages/DealsPage';
import { TransportationsPage } from './pages/TransportationsPage';
import { NewTransportationPage } from './pages/NewTransportationPage';
import { TransportationDetailPage } from './pages/TransportationDetailPage';
import { DealDetailPage } from './pages/DealDetailPage';
import { useAuth } from './auth/AuthContext';
import { LegalEntitiesPage } from './pages/LegalEntitiesPage';
import { SettingsLayout } from './components/SettingsLayout';
import { CurrenciesPage } from './pages/CurrenciesPage';
import { MotivationSettingsPage } from './pages/MotivationSettingsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentRequestsPage } from './pages/PaymentRequestsPage';
import { ReportsLayout } from './components/ReportsLayout';
import { CashCalendarPage } from './pages/CashCalendarPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { PayablesPage } from './pages/PayablesPage';
import { MotivationLayout } from './components/MotivationLayout';
import { MyMotivationPage } from './pages/MyMotivationPage';
import { MotivationReportPage } from './pages/MotivationReportPage';

const INVOICE_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'DEPARTMENT_HEAD',
  'MANAGER',
  'FINANCIER',
];

const LEAD_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'];

function DealsRoute() {
  const { user } = useAuth();
  const isLogistOnly = user?.roles.length === 1 && user.roles[0] === 'LOGIST';
  return isLogistOnly ? <Navigate to="/transportations" replace /> : <DealsPage />;
}

function DealDetailRoute() {
  const { user } = useAuth();
  const isLogistOnly = user?.roles.length === 1 && user.roles[0] === 'LOGIST';
  return isLogistOnly ? <Navigate to="/transportations" replace /> : <DealDetailPage />;
}

function LeadsRoute() {
  const { user } = useAuth();
  const canAccess = Boolean(user?.roles.some((role) => LEAD_ROLES.includes(role)));
  if (!canAccess) return <Navigate to="/transportations" replace />;
  return <LeadsPage />;
}

function InvoicesRoute() {
  const { user } = useAuth();
  const canAccess = Boolean(
    user?.roles.some((role) => INVOICE_ROLES.includes(role)),
  );
  if (!canAccess) return <Navigate to="/transportations" replace />;
  return <InvoicesPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/transportations" replace />} />
          <Route path="transportations" element={<TransportationsPage />} />
          <Route path="transportations/new" element={<NewTransportationPage />} />
          <Route path="transportations/:id" element={<TransportationDetailPage />} />
          <Route path="contractors" element={<ContractorsPage />} />
          <Route path="leads" element={<LeadsRoute />} />
          <Route path="deals" element={<DealsRoute />} />
          <Route path="deals/:id" element={<DealDetailRoute />} />
          <Route path="invoices" element={<InvoicesRoute />} />
          <Route path="payment-requests" element={<PaymentRequestsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="legal-entities" replace />} />
            <Route path="legal-entities" element={<LegalEntitiesPage />} />
            <Route path="currencies" element={<CurrenciesPage />} />
            <Route path="motivation" element={<MotivationSettingsPage />} />
          </Route>
          <Route path="reports" element={<ReportsLayout />}>
            <Route index element={<Navigate to="cash-calendar" replace />} />
            <Route path="cash-calendar" element={<CashCalendarPage />} />
            <Route path="receivables" element={<ReceivablesPage />} />
            <Route path="payables" element={<PayablesPage />} />
          </Route>
          <Route path="motivation" element={<MotivationLayout />}>
            <Route index element={<Navigate to="my" replace />} />
            <Route path="my" element={<MyMotivationPage />} />
            <Route path="summary" element={<MotivationReportPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/transportations" replace />} />
    </Routes>
  );
}
