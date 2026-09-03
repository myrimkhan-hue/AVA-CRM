import { Button, Checkbox, Form, Input } from 'antd';
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
  const [passwordVisible, setPasswordVisible] = useState(false);

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

  const passwordToggleLabel = t(
    passwordVisible ? 'login.hidePassword' : 'login.showPassword',
  );

  return (
    <main className="login-page">
      <section className="login-form-column">
        <div className="login-content">
          <img className="login-logo" src={logo} alt={t('brand.logoAlt')} />
          <h1 className="login-title">{t('login.title')}</h1>
          <p className="login-subtitle">{t('login.help')}</p>

          <div className="login-form-panel">
            {error && (
              <div className="login-error-message" role="alert">{error}</div>
            )}
            <Form<LoginValues>
              layout="vertical"
              onFinish={submit}
              requiredMark={false}
            >
              <div className="login-field-label">
                <label htmlFor="login-email">{t('login.email')}</label>
              </div>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: t('validation.emailRequired') },
                  { type: 'email', message: t('validation.emailInvalid') },
                ]}
              >
                <Input
                  id="login-email"
                  autoComplete="email"
                  placeholder={t('login.emailPlaceholder')}
                />
              </Form.Item>

              <div className="login-field-label">
                <label htmlFor="login-password">{t('login.password')}</label>
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={passwordToggleLabel}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordToggleLabel}
                </button>
              </div>
              <Form.Item
                name="password"
                rules={[{ required: true, message: t('validation.passwordRequired') }]}
              >
                <Input
                  id="login-password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('login.passwordPlaceholder')}
                />
              </Form.Item>

              <Form.Item
                name="remember"
                valuePropName="checked"
                className="login-remember-item"
              >
                <Checkbox>{t('login.remember')}</Checkbox>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                className="login-submit"
              >
                {t('login.submit')}
              </Button>
            </Form>
            <p className="login-password-help">{t('login.forgotPassword')}</p>
          </div>

          <p className="login-role-note">{t('login.roleNote')}</p>
        </div>
      </section>

      <section className="login-promo">
        <div className="login-promo-content">
          <h2>{t('login.promoTitle')}</h2>
          <div className="login-capabilities">
            {(['transportations', 'finances', 'documents'] as const).map((item) => (
              <div className="login-capability" key={item}>
                <strong>{t(`login.capabilities.${item}.title`)}</strong>
                <span>{t(`login.capabilities.${item}.description`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
