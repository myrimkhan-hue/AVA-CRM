import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MoneyInput } from '../components/MoneyInput';
import {
  DELIVERY_TERMS,
  QUOTE_CURRENCIES,
  Quote,
  QuoteFormValues,
  QuoteReference,
  QuoteUserReference,
  quotePayload,
} from '../quotes/shared';
import { MODES } from '../transportations/shared';

export function NewQuotePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<QuoteFormValues>();
  const [users, setUsers] = useState<QuoteUserReference[]>([]);
  const [departments, setDepartments] = useState<QuoteReference[]>([]);
  const [legalEntities, setLegalEntities] = useState<QuoteReference[]>([]);
  const [clients, setClients] = useState<QuoteReference[]>([]);
  const [saving, setSaving] = useState(false);
  const clientMode = Form.useWatch('clientMode', form) ?? 'existing';
  const responsibleId = Form.useWatch('responsibleId', form);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const searchClients = useCallback(async (value = '') => {
    try {
      const params = new URLSearchParams({ type: 'CLIENT' });
      if (value.trim()) params.set('search', value.trim());
      setClients(await apiRequest<QuoteReference[]>(`/contractors?${params.toString()}`));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  useEffect(() => {
    Promise.all([
      apiRequest<QuoteUserReference[]>('/references/users'),
      apiRequest<QuoteReference[]>('/departments'),
      apiRequest<QuoteReference[]>('/legal-entities'),
    ]).then(([userRows, departmentRows, legalEntityRows]) => {
      setUsers(userRows);
      setDepartments(departmentRows);
      setLegalEntities(legalEntityRows);
      const current = userRows.find((item) => item.id === user?.id);
      form.setFieldsValue({
        responsibleId: user?.id,
        departmentId: current?.department?.id ?? user?.departmentId ?? undefined,
      });
    }).catch(showError);
    void searchClients();
  }, [form, searchClients, showError, user?.departmentId, user?.id]);

  useEffect(() => {
    const responsible = users.find((item) => item.id === responsibleId);
    if (responsible?.department) {
      form.setFieldValue('departmentId', responsible.department.id);
    }
  }, [form, responsibleId, users]);

  const managers = useMemo(() => users.filter((item) => item.roles.some(
    (role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role),
  )), [users]);
  const logists = useMemo(() => users.filter((item) => item.roles.includes('LOGIST')), [users]);

  const submit = async (values: QuoteFormValues) => {
    setSaving(true);
    try {
      const created = await apiRequest<Quote>('/quotes', {
        method: 'POST',
        body: JSON.stringify(quotePayload(values)),
      });
      void message.success(t('quotes.messages.created', { number: created.number }));
      navigate(`/quotes/${created.id}`);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = QUOTE_CURRENCIES.map((value) => ({ value, label: value }));

  return (
    <section className="transportation-workspace quote-form-page">
      <Button
        type="link"
        className="back-link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/quotes')}
      >
        {t('quotes.actions.backToList')}
      </Button>

      <div className="wizard-header-panel">
        <h1>{t('quotes.create.title')}</h1>
        <p>{t('quotes.create.subtitle')}</p>
      </div>

      <Form<QuoteFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          clientMode: 'existing',
          transportMode: 'AUTO',
          isDangerous: false,
          placesUnit: t('quotes.defaults.placesUnit'),
          clientTargetRateCurrency: 'KZT',
          // Курс почти всегда фиксируется днём просчёта — не заставляем выбирать дату руками.
          quoteRateDate: dayjs(),
        }}
        onFinish={(values) => void submit(values)}
      >
        <Card className="transport-card quote-form-card" title={t('quotes.sections.clientAndTeam')}>
          <Form.Item name="clientMode" label={t('quotes.fields.clientMode')}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'existing', label: t('quotes.clientModes.existing') },
                { value: 'new', label: t('quotes.clientModes.new') },
              ]}
            />
          </Form.Item>
          <div className="form-grid two">
            {clientMode === 'existing' ? (
              <Form.Item
                name="clientId"
                label={t('quotes.fields.client')}
                rules={[{ required: true, message: t('quotes.validation.client') }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  placeholder={t('quotes.placeholders.client')}
                  options={clients.map((item) => ({ value: item.id, label: item.name }))}
                  onSearch={(value) => void searchClients(value)}
                  onFocus={() => void searchClients()}
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="clientName"
                label={t('quotes.fields.newClientName')}
                rules={[{ required: true, whitespace: true, message: t('quotes.validation.clientName') }]}
              >
                <Input placeholder={t('quotes.placeholders.newClientName')} />
              </Form.Item>
            )}
            <Form.Item
              name="legalEntityId"
              label={t('quotes.fields.legalEntity')}
              rules={[{ required: true, message: t('quotes.validation.legalEntity') }]}
            >
              <Select options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item name="responsibleId" label={t('quotes.fields.responsible')}>
              <Select
                showSearch
                optionFilterProp="label"
                options={managers.map((item) => ({ value: item.id, label: item.fullName }))}
              />
            </Form.Item>
            <Form.Item
              name="logistId"
              label={t('quotes.fields.logist')}
              rules={[{ required: true, message: t('quotes.validation.logist') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={logists.map((item) => ({ value: item.id, label: item.fullName }))}
              />
            </Form.Item>
            <Form.Item name="departmentId" label={t('quotes.fields.department')}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={departments.map((item) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
          </div>
        </Card>

        <Card className="transport-card quote-form-card" title={t('quotes.sections.cargo')}>
          <div className="form-grid two">
            <Form.Item
              name="originPoint"
              label={t('quotes.fields.origin')}
              rules={[{ required: true, whitespace: true, message: t('quotes.validation.origin') }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="destinationPoint"
              label={t('quotes.fields.destination')}
              rules={[{ required: true, whitespace: true, message: t('quotes.validation.destination') }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="cargoName" label={t('quotes.fields.cargoName')}>
              <Input />
            </Form.Item>
            <Form.Item name="transportMode" label={t('quotes.fields.transportMode')}>
              <Select options={MODES.map((value) => ({
                value,
                label: t(`transportations.transportModes.${value}`),
              }))} />
            </Form.Item>
            <Form.Item name="weightKg" label={t('quotes.fields.weight')}>
              <InputNumber min={0} precision={3} className="full-width" />
            </Form.Item>
            <Form.Item name="volumeM3" label={t('quotes.fields.volume')}>
              <InputNumber min={0} precision={3} className="full-width" />
            </Form.Item>
            <Form.Item label={t('quotes.fields.places')}>
              <Space.Compact block>
                <Form.Item name="placesCount" noStyle>
                  <InputNumber min={1} precision={0} className="quote-places-count" />
                </Form.Item>
                <Form.Item name="placesUnit" noStyle>
                  <Input placeholder={t('quotes.placeholders.placesUnit')} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="deliveryTerms" label={t('quotes.fields.deliveryTerms')}>
              <Select allowClear options={DELIVERY_TERMS.map((value) => ({ value, label: value }))} />
            </Form.Item>
            <Form.Item name="cargoReadyDate" label={t('quotes.fields.cargoReadyDate')}>
              <DatePicker className="full-width" />
            </Form.Item>
            <Form.Item name="isDangerous" valuePropName="checked" className="quote-checkbox-field">
              <Checkbox>{t('quotes.fields.isDangerous')}</Checkbox>
            </Form.Item>
          </div>
        </Card>

        <Card className="transport-card quote-form-card" title={t('quotes.sections.money')}>
          <Typography.Paragraph type="secondary">
            {t('quotes.hints.clientTargetRate')}
          </Typography.Paragraph>
          <div className="form-grid two">
            <Form.Item label={t('quotes.fields.clientTargetRate')}>
              <Space.Compact block>
                <Form.Item name="clientTargetRate" noStyle>
                  <MoneyInput min={0} className="money-number" />
                </Form.Item>
                <Form.Item name="clientTargetRateCurrency" noStyle>
                  <Select className="currency-select" options={currencyOptions} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item
              name="quoteRateDate"
              label={t('quotes.fields.quoteRateDate')}
              dependencies={['clientTargetRateCurrency']}
              rules={[({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('clientTargetRate') || value) return Promise.resolve();
                  return Promise.reject(new Error(t('quotes.validation.quoteRateDate')));
                },
              })]}
            >
              <DatePicker className="full-width" />
            </Form.Item>
          </div>
        </Card>

        <div className="quote-form-actions">
          <Button onClick={() => navigate('/quotes')}>{t('common.cancel')}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('quotes.actions.submit')}
          </Button>
        </div>
      </Form>
    </section>
  );
}
