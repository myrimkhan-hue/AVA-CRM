import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/ava-logo.svg';
import { useAuth } from '../auth/AuthContext';

const { Header, Content } = Layout;

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const canManageLegalEntities = Boolean(
    user?.roles.some((role) => role === 'ADMIN' || role === 'FINANCIER'),
  );
  const isLogistOnly = user?.roles.length === 1 && user.roles[0] === 'LOGIST';
  const canAccessInvoices = Boolean(
    user?.roles.some((role) => [
      'ADMIN',
      'DIRECTOR',
      'DEPARTMENT_HEAD',
      'MANAGER',
      'FINANCIER',
    ].includes(role)),
  );

  const navigation = useMemo(
    () => [
      { path: '/transportations', label: t('nav.transportations') },
      { path: '/contractors', label: t('nav.contractors') },
      ...(!isLogistOnly ? [{ path: '/deals', label: t('nav.deals') }] : []),
      ...(canAccessInvoices
        ? [{ path: '/invoices', label: t('nav.invoices') }]
        : []),
      ...(isAdmin ? [{ path: '/users', label: t('nav.users') }] : []),
      ...(canManageLegalEntities
        ? [{
          path: '/settings',
          label: t('nav.settings'),
        }]
        : []),
    ],
    [canAccessInvoices, canManageLegalEntities, isAdmin, isLogistOnly, t],
  );

  const initials = useMemo(
    () => user?.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join('') ?? '',
    [user?.fullName],
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header-inner">
          <button className="brand brand-button" onClick={() => navigate('/transportations')}>
            <img src={logo} alt={t('brand.logoAlt')} />
            <span>{t('brand.name')}</span>
          </button>

          <nav className="top-navigation" aria-label={t('nav.main')}>
            {navigation.map((item) => (
              <button
                key={item.path}
                className={`top-navigation-link${location.pathname.startsWith(item.path) ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="user-menu">
            <span className="user-initials" aria-hidden="true">{initials}</span>
            <span className="user-name">{user?.fullName}</span>
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
              {t('auth.logout')}
            </Button>
          </div>
        </div>
      </Header>
      <Content className="app-content"><Outlet /></Content>
    </Layout>
  );
}
