import { SettingOutlined } from '@ant-design/icons';
import { App, Badge, Button, Empty, List, Modal, Popover, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';

function BellIcon() {
  return (
    <svg className="header-action-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.6a4 4 0 0 1 8 0c0 3 1.2 4 1.2 4H2.8S4 9.6 4 6.6z" />
      <path d="M6.6 13a1.6 1.6 0 0 0 2.8 0" />
    </svg>
  );
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

interface PreferenceItem {
  type: string;
  enabled: boolean;
}

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  Deal: (id) => `/deals/${id}`,
  Transportation: (id) => `/transportations/${id}`,
  PaymentRequest: () => '/payment-requests',
  Lead: (id) => `/leads?open=${id}`,
  Contractor: (id) => `/contractors?open=${id}`,
};

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await apiRequest<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch {
      // Колокольчик не критичен для остальной работы — молча пропускаем сбой опроса.
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => void loadUnreadCount(), 60000);
    return () => window.clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<NotificationItem[]>('/notifications');
      setItems(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void loadList();
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' });
        setItems((current) => current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error: unknown) {
        void message.error(error instanceof Error ? error.message : String(error));
      }
    }
    const route = ENTITY_ROUTES[item.entityType]?.(item.entityId);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((row) => ({ ...row, isRead: true })));
      setUnreadCount(0);
    } catch (error: unknown) {
      void message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const openSettings = async () => {
    try {
      const result = await apiRequest<PreferenceItem[]>('/notifications/preferences');
      setPreferences(result);
      setOpen(false);
      setSettingsOpen(true);
    } catch (error: unknown) {
      void message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const togglePreference = async (type: string, enabled: boolean) => {
    const next = preferences.map((item) => (item.type === type ? { ...item, enabled } : item));
    setPreferences(next);
    try {
      await apiRequest('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ items: next }),
      });
    } catch (error: unknown) {
      void message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

  const content = (
    <div className="notification-panel" onKeyDown={(event) => {
      if (event.key === 'Escape') setOpen(false);
    }}>
      <div className="notification-panel-header">
        <Typography.Text strong>{t('notifications.title')}</Typography.Text>
        <div className="notification-panel-actions">
          <Button type="text" size="small" onClick={() => void markAllRead()} disabled={!unreadCount}>
            {t('notifications.markAllRead')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            aria-label={t('notifications.openSettings')}
            title={t('notifications.openSettings')}
            onClick={() => void openSettings()}
          />
        </div>
      </div>
      <List<NotificationItem>
        className="notification-list"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notifications.empty')} /> }}
        renderItem={(item) => (
          <List.Item
            className={`notification-item${item.isRead ? '' : ' unread'}`}
            onClick={() => void handleItemClick(item)}
          >
            <span className={`notification-dot${item.isRead ? ' read' : ''}`} aria-hidden="true" />
            <div className="notification-item-content">
              <div className="notification-item-title">{item.title}</div>
              <div className="notification-item-message">{item.message}</div>
              <div className="notification-date">{formatDateTime(item.createdAt)}</div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <>
      <Popover
        trigger="click"
        placement="bottomRight"
        open={open}
        onOpenChange={handleOpenChange}
        content={content}
        classNames={{ root: 'notification-popover' }}
      >
        <Badge className="notification-bell" count={unreadCount} size="small">
          <Button
            type="text"
            className="header-icon-button notification-bell-button"
            icon={<BellIcon />}
            aria-label={t('notifications.title')}
            title={t('notifications.title')}
          />
        </Badge>
      </Popover>
      <Modal open={settingsOpen} title={t('notifications.settingsTitle')} onCancel={() => setSettingsOpen(false)} footer={null}>
        <Typography.Paragraph type="secondary">{t('notifications.settingsHint')}</Typography.Paragraph>
        {preferences.map((item) => (
          <div key={item.type} className="notification-preference-row">
            <span>{t(`notifications.types.${item.type}`)}</span>
            <Switch checked={item.enabled} onChange={(checked) => void togglePreference(item.type, checked)} />
          </div>
        ))}
      </Modal>
    </>
  );
}
