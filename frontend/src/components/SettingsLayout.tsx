import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SettingsLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = Boolean(
    user?.roles.some((role) => role === 'ADMIN' || role === 'FINANCIER'),
  );
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const activeKey = location.pathname.includes('/settings/currencies')
    ? 'currencies'
    : location.pathname.includes('/settings/motivation')
      ? 'motivation'
      : location.pathname.includes('/settings/whatsapp-templates')
        ? 'whatsapp-templates'
        : 'legal-entities';

  if (!canManage) return <Navigate to="/" replace />;

  return (
    <div className="settings-page">
      <Tabs
        className="settings-tabs"
        activeKey={activeKey}
        onChange={(key) => navigate(`/settings/${key}`)}
        items={[
          {
            key: 'legal-entities',
            label: t('settings.tabs.legalEntities'),
          },
          {
            key: 'currencies',
            label: t('settings.tabs.currencies'),
          },
          {
            key: 'motivation',
            label: t('settings.tabs.motivation'),
          },
          ...(isAdmin ? [{
            key: 'whatsapp-templates',
            label: t('settings.tabs.whatsappTemplates'),
          }] : []),
        ]}
      />
      <Outlet />
    </div>
  );
}
