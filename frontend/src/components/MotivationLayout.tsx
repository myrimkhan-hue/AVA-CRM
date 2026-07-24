import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function MotivationLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canSeeSummary = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER', 'DEPARTMENT_HEAD'].includes(role)),
  );
  const activeKey = location.pathname.includes('/motivation/summary') ? 'summary' : 'my';

  if (activeKey === 'summary' && !canSeeSummary) return <Navigate to="/motivation/my" replace />;

  return (
    <div className="settings-page">
      <Tabs
        className="settings-tabs"
        activeKey={activeKey}
        onChange={(key) => navigate(`/motivation/${key}`)}
        items={[
          { key: 'my', label: t('motivation.tabs.my') },
          ...(canSeeSummary ? [{ key: 'summary', label: t('motivation.tabs.summary') }] : []),
        ]}
      />
      <Outlet />
    </div>
  );
}
