import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ReportsLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canView = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role)),
  );

  const activeKey = location.pathname.includes('/reports/receivables')
    ? 'receivables'
    : location.pathname.includes('/reports/payables')
      ? 'payables'
      : location.pathname.includes('/reports/cash-calendar')
        ? 'cash-calendar'
        : 'dashboard';

  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="settings-page">
      <Tabs
        className="settings-tabs"
        activeKey={activeKey}
        onChange={(key) => navigate(`/reports/${key}`)}
        items={[
          { key: 'dashboard', label: t('reports.tabs.dashboard') },
          { key: 'cash-calendar', label: t('reports.tabs.cashCalendar') },
          { key: 'receivables', label: t('reports.tabs.receivables') },
          { key: 'payables', label: t('reports.tabs.payables') },
        ]}
      />
      <Outlet />
    </div>
  );
}
