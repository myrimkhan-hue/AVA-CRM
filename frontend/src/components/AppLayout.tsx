import {
  ApartmentOutlined,
  CarOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/ava-logo.svg';
import { useAuth } from '../auth/AuthContext';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.roles.includes('ADMIN');

  const items = useMemo(
    () => [
      { key: 'transportations', icon: <CarOutlined />, label: t('nav.transportations'), disabled: true },
      { key: 'contractors', icon: <ApartmentOutlined />, label: t('nav.contractors'), disabled: true },
      { key: 'deals', icon: <ApartmentOutlined />, label: t('nav.deals'), disabled: true },
      ...(isAdmin
        ? [{ key: '/users', icon: <TeamOutlined />, label: t('nav.users') }]
        : []),
    ],
    [isAdmin, t],
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <button className="brand brand-button" onClick={() => navigate('/')}>
          <img src={logo} alt={t('brand.logoAlt')} />
          <span>{t('brand.name')}</span>
        </button>
        <div className="user-menu">
          <Avatar icon={<UserOutlined />} />
          <Typography.Text className="user-name">{user?.fullName}</Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            {t('auth.logout')}
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider width={224} breakpoint="lg" collapsedWidth="0" className="app-sider">
          <Menu
            mode="inline"
            items={items}
            selectedKeys={[location.pathname]}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Content className="app-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
