import { BellOutlined, SettingOutlined } from '@ant-design/icons';
import { App, Badge, Button, Empty, List, Modal, Popover, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';

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
    <div className="notification-panel">
      <div className="notification-panel-header">
        <Typography.Text strong>{t('notifications.title')}</Typography.Text>
        <div className="notification-panel-actions">
          <Button type="text" size="small" onClick={() => void markAllRead()} disabled={!unreadCount}>
            {t('notifications.markAllRead')}
          </Button>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => void openSettings()} />
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
            <div>
              <Typography.Text strong>{item.title}</Typography.Text>
              <div>{item.message}</div>
              <Typography.Text type="secondary" className="notification-date">
                {formatDateTime(item.createdAt)}
              </Typography.Text>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <>
      <Popover trigger="click" placement="bottomRight" open={open} onOpenChange={handleOpenChange} content={content}>
        <Badge count={unreadCount} size="small" offset={[-4, 4]}>
          <Button type="text" icon={<BellOutlined />} aria-label={t('notifications.title')} />
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
