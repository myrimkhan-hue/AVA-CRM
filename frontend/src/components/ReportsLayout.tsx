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
  const canViewQuoteConversion = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'].includes(role)),
  );
  const isQuoteConversion = location.pathname === '/reports/quote-conversion';

  const activeKey = location.pathname.includes('/reports/receivables')
    ? 'receivables'
    : location.pathname.includes('/reports/payables')
      ? 'payables'
      : location.pathname.includes('/reports/cash-calendar')
        ? 'cash-calendar'
        : 'dashboard';

  if (isQuoteConversion ? !canViewQuoteConversion : !canView) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="settings-page">
      <Tabs
        className="settings-tabs"
        activeKey={isQuoteConversion ? 'quote-conversion' : activeKey}
        onChange={(key) => navigate(`/reports/${key}`)}
        items={[
          ...(canView ? [
          { key: 'dashboard', label: t('reports.tabs.dashboard') },
          { key: 'cash-calendar', label: t('reports.tabs.cashCalendar') },
          { key: 'receivables', label: t('reports.tabs.receivables') },
          { key: 'payables', label: t('reports.tabs.payables') },
          ] : []),
          ...(canViewQuoteConversion ? [
            { key: 'quote-conversion', label: t('reports.quoteConversion.title') },
          ] : []),
        ]}
      />
      <Outlet />
    </div>
  );
}
