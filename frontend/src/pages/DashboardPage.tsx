import { Card, Flex, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../api/client';

type Health = { status: 'ok'; db: 'ok' | 'error' };
type ViewState = 'loading' | 'ok' | 'error' | 'unavailable';

export function DashboardPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>('loading');

  useEffect(() => {
    apiRequest<Health>('/health')
      .then((health) => setState(health.db === 'ok' ? 'ok' : 'error'))
      .catch(() => setState('unavailable'));
  }, []);

  return (
    <Card className="health-card" title={t('app.title')}>
      <Flex vertical gap="middle">
        <Typography.Title level={3}>{t('health.title')}</Typography.Title>
        {state === 'loading' ? (
          <Flex gap="small" align="center"><Spin size="small" /><Typography.Text>{t('health.loading')}</Typography.Text></Flex>
        ) : (
          <Tag color={state === 'ok' ? 'success' : 'error'}>{t(`health.${state}`)}</Tag>
        )}
      </Flex>
    </Card>
  );
}
