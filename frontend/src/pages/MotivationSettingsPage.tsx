import { App, Button, Card, Form, InputNumber, Space, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';

interface Settings {
  bonusRatePercent: string;
}

interface FormValues {
  bonusRatePercent: number;
}

export function MotivationSettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [settings, setSettings] = useState<Settings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<Settings>('/motivation/settings');
      setSettings(result);
      form.setFieldsValue({ bonusRatePercent: Number(result.bonusRatePercent) });
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [form, showError]);

  useEffect(() => { void load(); }, [load]);

  const save = async (values: FormValues) => {
    setSaving(true);
    try {
      const result = await apiRequest<Settings>('/motivation/settings', {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setSettings(result);
      void message.success(t('motivation.settingsPage.saved'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin className="detail-spin" />;

  return (
    <Card className="transport-card legal-entities-page">
      <Typography.Paragraph type="secondary">
        {t('motivation.settingsPage.hint')}
      </Typography.Paragraph>
      <Form<FormValues> form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Space align="end" size="middle">
          <Form.Item
            name="bonusRatePercent"
            label={t('motivation.settingsPage.rate')}
            rules={[{ required: true, message: t('motivation.settingsPage.rateRequired') }]}
          >
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </Form.Item>
        </Space>
      </Form>
      {settings && (
        <Typography.Text type="secondary">
          {t('motivation.settingsPage.current', { rate: settings.bonusRatePercent })}
        </Typography.Text>
      )}
    </Card>
  );
}
