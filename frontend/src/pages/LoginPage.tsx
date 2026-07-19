import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import logo from '../assets/ava-logo.svg';
import { useAuth } from '../auth/AuthContext';

interface LoginValues {
  email: string;
  password: string;
  remember?: boolean;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (values: LoginValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      await login(values.email, values.password, Boolean(values.remember));
      const from = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname;
      navigate(from ?? '/', { replace: true });
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message || t('errors.request')
          : t('errors.connection'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-card">
          <div className="login-brand">
            <img src={logo} alt={t('brand.logoAlt')} />
            <div>
              <div className="login-brand-name">{t('brand.name')}</div>
              <div className="login-brand-subtitle">{t('brand.subtitle')}</div>
            </div>
          </div>
          <Typography.Title level={2}>{t('login.title')}</Typography.Title>
          <Typography.Paragraph className="login-help">
            {t('login.help')}
          </Typography.Paragraph>
          {error && <Alert type="error" showIcon message={error} className="login-error" />}
          <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item
              label={t('login.email')}
              name="email"
              rules={[
                { required: true, message: t('validation.emailRequired') },
                { type: 'email', message: t('validation.emailInvalid') },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder={t('login.emailPlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('validation.passwordRequired') }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('login.passwordPlaceholder')} />
            </Form.Item>
            <Form.Item name="remember" valuePropName="checked" className="remember-item">
              <Checkbox>{t('login.remember')}</Checkbox>
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} size="large">
              {t('login.submit')}
            </Button>
          </Form>
          <div className="security-note"><LockOutlined /> {t('login.security')}</div>
        </div>
      </section>
      <section className="login-visual" aria-hidden="true">
        <div className="visual-mark" />
      </section>
    </main>
  );
}
