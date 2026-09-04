import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Drawer, Input, Layout } from 'antd';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/ava-logo.svg';
import { useAuth } from '../auth/AuthContext';
import {
  getHeaderTitleKey,
  getVisibleNavigationGroups,
  isNavigationItemActive,
  type NavigationIconName,
  type NavigationItem,
} from '../navigation';
import { useThemeMode } from '../theme/ThemeContext';
import { NotificationBell } from './NotificationBell';

const { Header, Content } = Layout;

const NAVIGATION_ICON_CONTENT: Record<NavigationIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1.5" />
      <rect x="9" y="2" width="5" height="5" rx="1.5" />
      <rect x="2" y="9" width="5" height="5" rx="1.5" />
      <rect x="9" y="9" width="5" height="5" rx="1.5" />
    </>
  ),
  quotes: (
    <>
      <path d="M3 2.2h10v11.6H3z" />
      <path d="M5.5 5.2h5M5.5 8h5M5.5 10.8h2.8" />
    </>
  ),
  transportations: (
    <>
      <path d="M1.5 4.5h7.5v6.5H1.5z" />
      <path d="M9 7h3l2 2.2V11H9z" />
      <circle cx="4.4" cy="12.4" r="1.3" />
      <circle cx="11.4" cy="12.4" r="1.3" />
    </>
  ),
  deals: <path d="M2 12.5V9M6 12.5V5.5M10 12.5V7.5M14 12.5V3.5" />,
  leads: <path d="M2 3.5h12L9.2 8.6v4.2L6.8 11.4V8.6z" />,
  contractors: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <path d="M1.8 13c.4-2.2 2.1-3.4 4.2-3.4S9.8 10.8 10.2 13M11 4.2a2.2 2.2 0 0 1 0 4.2" />
    </>
  ),
  invoices: (
    <>
      <path d="M3.5 1.8h9v12.4l-2.2-1.4-2.3 1.4-2.3-1.4-2.2 1.4z" />
      <path d="M6 5.4h4M6 8.2h4" />
    </>
  ),
  paymentRequests: (
    <>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.6" />
      <path d="M1.8 6.8h12.4" />
    </>
  ),
  documents: (
    <>
      <path d="M4 1.8h5l3 3v9.4H4z" />
      <path d="M9 1.8v3h3M6 8.4h4M6 11h2.6" />
    </>
  ),
  operatingExpenses: (
    <>
      <path d="M2.4 13.6V6.4M6.1 13.6V2.6M9.9 13.6V8.4M13.6 13.6v-3.4" />
      <path d="M1.4 13.6h13.2" />
    </>
  ),
  cashCalendar: (
    <>
      <rect x="2" y="3" width="12" height="11" rx="1.6" />
      <path d="M2 6.4h12M5.4 1.8v2.4M10.6 1.8v2.4" />
    </>
  ),
  reports: <path d="M8 2a6 6 0 1 0 6 6H8z" />,
  motivation: (
    <>
      <path d="M4.4 2h7.2v3.6a3.6 3.6 0 0 1-7.2 0z" />
      <path d="M8 9.2v2.4M5.6 14h4.8" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M3 13.2c.6-2.4 2.6-3.6 5-3.6s4.4 1.2 5 3.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" />
    </>
  ),
};

function NavigationIcon({ name }: { name: NavigationIconName }) {
  return (
    <svg
      className="sidebar-nav-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {NAVIGATION_ICON_CONTENT[name]}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="header-action-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a5.7 5.7 0 1 0 7 7z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="header-action-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4V3M8 13v1.6M1.4 8H3M13 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="header-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" />
      <path d="m10.6 10.6 3.4 3.4" />
    </svg>
  );
}

interface SidebarNavigationProps {
  groups: NavigationItem[][];
  pathname: string;
  onNavigate: (path: string) => void;
  mobile?: boolean;
}

function SidebarNavigation({ groups, pathname, onNavigate, mobile = false }: SidebarNavigationProps) {
  const { t } = useTranslation();

  return (
    <nav className={`sidebar-navigation${mobile ? ' mobile' : ''}`} aria-label={t('nav.main')}>
      {groups.map((group, groupIndex) => (
        <div className="sidebar-navigation-group" key={group[0].id}>
          {groupIndex > 0 && <div className="sidebar-navigation-divider" />}
          {group.map((item) => {
            const label = t(item.labelKey);
            const active = isNavigationItemActive(item, pathname);

            return (
              <button
                type="button"
                className={`sidebar-navigation-item${active ? ' active' : ''}`}
                key={item.id}
                title={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.path)}
              >
                <NavigationIcon name={item.icon} />
                <span className="sidebar-navigation-label">{label}</span>
                {item.badge !== undefined && (
                  <span className="sidebar-navigation-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const roles = useMemo(() => user?.roles ?? [], [user?.roles]);
  const navigationGroups = useMemo(() => getVisibleNavigationGroups(roles), [roles]);
  const initials = useMemo(
    () => user?.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join('') ?? '',
    [user?.fullName],
  );
  const roleLabels = roles.map((role) => t(`roles.${role}`)).join(', ');
  const headerTitle = t(getHeaderTitleKey(location.pathname));

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const routeSearch = location.pathname === '/transportations'
      ? new URLSearchParams(location.search).get('search') ?? ''
      : '';
    setHeaderSearch(routeSearch);
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleHeaderSearch = () => {
    const query = headerSearch.trim();
    const suffix = query ? `?search=${encodeURIComponent(query)}` : '';
    navigate(`/transportations${suffix}`);
  };

  const handleDrawerNavigate = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <Layout className="app-shell">
      <div className="app-sidebar-slot">
        <aside className="app-sidebar">
          <button type="button" className="sidebar-brand" onClick={() => navigate('/transportations')}>
            <img src={logo} alt={t('brand.logoAlt')} />
            <span className="sidebar-brand-copy">
              <strong>{t('brand.name')}</strong>
              <span>{t('brand.tagline')}</span>
            </span>
          </button>

          <SidebarNavigation
            groups={navigationGroups}
            pathname={location.pathname}
            onNavigate={navigate}
          />

          <div className="sidebar-user">
            <button
              type="button"
              className="sidebar-user-profile"
              aria-label={t('profile.open')}
              onClick={() => navigate('/profile')}
            >
              <span className="sidebar-user-avatar" aria-hidden="true">{initials}</span>
              <span className="sidebar-user-copy">
                <strong>{user?.fullName}</strong>
                <span>{roleLabels}</span>
              </span>
            </button>
            <button
              type="button"
              className="sidebar-logout"
              aria-label={t('auth.logout')}
              title={t('auth.logout')}
              onClick={handleLogout}
            >
              <LogoutOutlined />
            </button>
          </div>
        </aside>
      </div>

      <Layout className="app-main">
        <Header className="app-header">
          <Button
            type="text"
            className="nav-burger header-icon-button"
            icon={<MenuOutlined />}
            aria-label={t('nav.openMenu')}
            title={t('nav.openMenu')}
            onClick={() => setMenuOpen(true)}
          />

          <div className="header-title-block">
            <strong>{headerTitle}</strong>
            <span>{t('header.subtitle', { roles: roleLabels })}</span>
          </div>

          <div className="header-actions">
            <Input
              className="header-search"
              prefix={<SearchIcon />}
              value={headerSearch}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchPlaceholder')}
              onChange={(event) => setHeaderSearch(event.target.value)}
              onPressEnter={handleHeaderSearch}
            />
            <Button
              type="text"
              className="header-icon-button header-theme-button"
              icon={mode === 'light' ? <MoonIcon /> : <SunIcon />}
              aria-label={t(mode === 'light' ? 'theme.toDark' : 'theme.toLight')}
              title={t(mode === 'light' ? 'theme.toDark' : 'theme.toLight')}
              onClick={toggleTheme}
            />
            <NotificationBell />
            <Button
              type="primary"
              className="header-new-transportation"
              aria-label={t('header.newTransportation')}
              onClick={() => navigate('/transportations/new')}
            >
              <span className="header-new-transportation-full">{t('header.newTransportation')}</span>
              <span className="header-new-transportation-compact" aria-hidden="true">
                {t('header.newTransportationCompact')}
              </span>
            </Button>
          </div>
        </Header>

        <Content className="app-content"><Outlet /></Content>
      </Layout>

      <Drawer
        className="nav-drawer"
        title={(
          <span className="drawer-brand">
            <img src={logo} alt="" />
            <span>
              <strong>{t('brand.name')}</strong>
              <small>{t('brand.tagline')}</small>
            </span>
          </span>
        )}
        placement="left"
        width={300}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        <SidebarNavigation
          groups={navigationGroups}
          pathname={location.pathname}
          onNavigate={handleDrawerNavigate}
          mobile
        />
      </Drawer>
    </Layout>
  );
}
