import { useEffect, useState } from 'react';
import { Card, Flex, Spin, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

type Health = { status: 'ok'; db: 'ok' | 'error' };
type ViewState = 'loading' | 'ok' | 'error' | 'unavailable';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Health>;
      })
      .then((health) => setState(health.db === 'ok' ? 'ok' : 'error'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState('unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <Card className="health-card" title={t('app.title')}>
        <Flex vertical gap="middle">
          <Typography.Title level={3}>{t('health.title')}</Typography.Title>
          {state === 'loading' ? (
            <Flex gap="small" align="center">
              <Spin size="small" />
              <Typography.Text>{t('health.loading')}</Typography.Text>
            </Flex>
          ) : (
            <Tag color={state === 'ok' ? 'success' : 'error'}>{t(`health.${state}`)}</Tag>
          )}
        </Flex>
      </Card>
    </main>
  );
}
