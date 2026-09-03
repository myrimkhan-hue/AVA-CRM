import { App, Button, Card, Form, Input, Spin, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import type { DocumentContactRecord } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface FormValues {
  documentName?: string;
  documentPhone?: string;
}

export function MyProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const initials = useMemo(
    () => user?.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join('') ?? '',
    [user?.fullName],
  );
  const roleLine = [user?.roles.map((role) => t(`roles.${role}`)).join(', '), user?.email].filter(Boolean).join(' · ');
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [profile, setProfile] = useState<DocumentContactRecord>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  useEffect(() => {
    apiRequest<DocumentContactRecord>('/profile')
      .then((result) => {
        setProfile(result);
        form.setFieldsValue({
          documentName: result.documentName ?? undefined,
          documentPhone: result.documentPhone ?? undefined,
        });
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [form, showError]);

  const save = async (values: FormValues) => {
    setSaving(true);
    try {
      const result = await apiRequest<DocumentContactRecord>(
        '/profile/document-contact',
        { method: 'PATCH', body: JSON.stringify(values) },
      );
      setProfile(result);
      void message.success(t('profile.saved'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <Card>
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">{initials}</span>
          <div>
            <Typography.Title level={2}>{profile?.fullName ?? t('profile.title')}</Typography.Title>
            <Typography.Text type="secondary">{roleLine}</Typography.Text>
          </div>
        </div>
        <Typography.Paragraph type="secondary" className="profile-subtitle">
          {t('profile.subtitle')}
        </Typography.Paragraph>
        {loading ? <Spin /> : (
          <Form<FormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => void save(values)}
          >
            <Form.Item
              name="documentName"
              label={t('profile.documentName')}
              extra={t('profile.documentNameHint', { name: profile?.fullName })}
            ><Input /></Form.Item>
            <Form.Item
              name="documentPhone"
              label={t('profile.documentPhone')}
              extra={t('profile.documentPhoneHint', {
                phone: profile?.phone || t('common.notSpecified'),
              })}
            ><Input /></Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
