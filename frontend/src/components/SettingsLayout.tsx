import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Порядок вкладок задан макетом. WhatsApp-шаблоны, шаблоны документов и
// тексты об оплате доступны только администратору — на сервере эти разделы
// помечены @Roles('ADMIN'), поэтому остальным пункт даже не показываем.
const SETTINGS_SECTIONS = [
  { key: 'legal-entities', labelKey: 'settings.tabs.legalEntities', adminOnly: false },
  { key: 'currencies', labelKey: 'settings.tabs.currencies', adminOnly: false },
  { key: 'operating-expense-types', labelKey: 'settings.tabs.operatingExpenseTypes', adminOnly: false },
  { key: 'motivation', labelKey: 'settings.tabs.motivation', adminOnly: false },
  { key: 'whatsapp-templates', labelKey: 'settings.tabs.whatsappTemplates', adminOnly: true },
  { key: 'document-templates', labelKey: 'settings.tabs.documentTemplates', adminOnly: true },
  { key: 'document-payment-texts', labelKey: 'settings.tabs.documentPaymentTexts', adminOnly: true },
] as const;

export function SettingsLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = Boolean(
    user?.roles.some((role) => role === 'ADMIN' || role === 'FINANCIER'),
  );
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const sections = SETTINGS_SECTIONS.filter((section) => isAdmin || !section.adminOnly);
  const activeKey = sections.find(
    (section) => location.pathname === `/settings/${section.key}`
      || location.pathname.startsWith(`/settings/${section.key}/`),
  )?.key ?? 'legal-entities';

  if (!canManage) return <Navigate to="/" replace />;

  return (
    <div className="settings-page settings-layout">
      <nav className="settings-menu" aria-label={t('settings.menuLabel')}>
        {sections.map((section) => (
          <button
            type="button"
            key={section.key}
            className={`settings-menu-item${activeKey === section.key ? ' active' : ''}`}
            aria-current={activeKey === section.key ? 'page' : undefined}
            onClick={() => navigate(`/settings/${section.key}`)}
          >
            {t(section.labelKey)}
          </button>
        ))}
      </nav>
      <div className="settings-content"><Outlet /></div>
    </div>
  );
}
