import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Drawer, Layout } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/ava-logo.svg';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from './NotificationBell';

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
  const canViewReports = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role)),
  );
  const isLogistOnly = user?.roles.length === 1 && user.roles[0] === 'LOGIST';
  const canAccessLeads = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role)),
  );
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
      ...(canAccessLeads ? [{ path: '/leads', label: t('nav.leads') }] : []),
      ...(!isLogistOnly ? [{ path: '/deals', label: t('nav.deals') }] : []),
      ...(canAccessInvoices
        ? [{ path: '/invoices', label: t('nav.invoices') }]
        : []),
      {
        path: '/payment-requests',
        label: t('nav.paymentRequests'),
      },
      ...(canViewReports ? [{ path: '/reports', label: t('nav.reports') }] : []),
      { path: '/motivation', label: t('nav.motivation') },
      ...(isAdmin ? [{ path: '/users', label: t('nav.users') }] : []),
      ...(canManageLegalEntities
        ? [{
          path: '/settings',
          label: t('nav.settings'),
        }]
        : []),
    ],
    [canAccessInvoices, canAccessLeads, canManageLegalEntities, canViewReports, isAdmin, isLogistOnly, t],
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

  // На узких экранах меню уезжает в выдвижную панель — 10 пунктов в строку не помещаются.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header-inner">
          <Button
            type="text"
            className="nav-burger"
            icon={<MenuOutlined />}
            aria-label={t('nav.main')}
            onClick={() => setMenuOpen(true)}
          />

          <button className="brand brand-button" onClick={() => navigate('/transportations')}>
            <img src={logo} alt={t('brand.logoAlt')} />
            <span>{t('brand.name')}</span>
          </button>

          <nav className="top-navigation" aria-label={t('nav.main')}>
            {navigation.map((item) => (
              <button
                key={item.path}
                className={`top-navigation-link${isActive(item.path) ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="user-menu">
            <NotificationBell />
            <span className="user-initials" aria-hidden="true">{initials}</span>
            <span className="user-name">{user?.fullName}</span>
            <Button
              type="text"
              className="logout-button"
              icon={<LogoutOutlined />}
              aria-label={t('auth.logout')}
              onClick={handleLogout}
            >
              <span className="logout-label">{t('auth.logout')}</span>
            </Button>
          </div>
        </div>
      </Header>

      <Drawer
        className="nav-drawer"
        title={t('brand.name')}
        placement="left"
        width={280}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        <nav className="drawer-navigation" aria-label={t('nav.main')}>
          {navigation.map((item) => (
            <button
              key={item.path}
              className={`drawer-navigation-link${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </Drawer>

      <Content className="app-content"><Outlet /></Content>
    </Layout>
  );
}
