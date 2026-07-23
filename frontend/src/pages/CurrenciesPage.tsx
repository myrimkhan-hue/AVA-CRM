import { EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import {
  CurrencyRecord,
  ExchangeRateRecord,
  FetchNbrkResult,
  RateSource,
} from '../api/types';

interface CurrencyFormValues {
  code: string;
  name: string;
  isActive?: boolean;
}

interface ManualRateFormValues {
  rateDate: Dayjs;
  rate: number;
}

export function CurrenciesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [rates, setRates] = useState<ExchangeRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CurrencyRecord>();
  const [manualOpen, setManualOpen] = useState(false);
  const [createForm] = Form.useForm<CurrencyFormValues>();
  const [editForm] = Form.useForm<CurrencyFormValues>();
  const [manualForm] = Form.useForm<ManualRateFormValues>();

  const selected = useMemo(
    () => currencies.find((item) => item.code === selectedCode),
    [currencies, selectedCode],
  );

  const showError = useCallback(
    (error: unknown) => {
      void message.error(
        error instanceof ApiError
          ? error.message || t('errors.request')
          : t('errors.connection'),
      );
    },
    [message, t],
  );

  const loadCurrencies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<CurrencyRecord[]>('/currencies');
      setCurrencies(data);
      setSelectedCode((current) =>
        current && data.some((item) => item.code === current)
          ? current
          : data.find((item) => !item.isBase)?.code ?? data[0]?.code,
      );
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadRates = useCallback(async (currencyCode: string) => {
    setRatesLoading(true);
    try {
      const data = await apiRequest<ExchangeRateRecord[]>(
        `/exchange-rates?currencyCode=${encodeURIComponent(currencyCode)}`,
      );
      setRates(data);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setRatesLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadCurrencies();
  }, [loadCurrencies]);

  useEffect(() => {
    if (selected && !selected.isBase) void loadRates(selected.code);
    else setRates([]);
  }, [loadRates, selected]);

  const createCurrency = async (values: CurrencyFormValues) => {
    setSaving(true);
    try {
      const created = await apiRequest<CurrencyRecord>('/currencies', {
        method: 'POST',
        body: JSON.stringify({ code: values.code, name: values.name }),
      });
      void message.success(t('currencies.messages.created'));
      setCreateOpen(false);
      createForm.resetFields();
      await loadCurrencies();
      setSelectedCode(created.code);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (currency: CurrencyRecord) => {
    setEditing(currency);
    editForm.setFieldsValue({
      code: currency.code,
      name: currency.name,
      isActive: currency.isActive,
    });
  };

  const updateCurrency = async (values: CurrencyFormValues) => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiRequest(`/currencies/${editing.code}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          isActive: values.isActive,
        }),
      });
      void message.success(t('currencies.messages.updated'));
      setEditing(undefined);
      await loadCurrencies();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const setManualRate = async (values: ManualRateFormValues) => {
    if (!selected || selected.isBase) return;
    setSaving(true);
    try {
      await apiRequest('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({
          currencyCode: selected.code,
          rateDate: values.rateDate.format('YYYY-MM-DD'),
          rate: values.rate,
        }),
      });
      void message.success(t('currencies.messages.manualSaved'));
      setManualOpen(false);
      manualForm.resetFields();
      await loadRates(selected.code);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const fetchToday = async () => {
    setFetching(true);
    try {
      const result = await apiRequest<FetchNbrkResult>(
        '/exchange-rates/fetch-nbrk',
        {
          method: 'POST',
          body: JSON.stringify({ date: dayjs().format('YYYY-MM-DD') }),
        },
      );
      void message.success(
        t('currencies.messages.fetched', {
          saved: result.saved,
          skipped: result.skippedManual,
        }),
      );
      if (selected && !selected.isBase) await loadRates(selected.code);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setFetching(false);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ru-RU', { timeZone: 'UTC' });

  const sourceLabel = (source: RateSource) =>
    t(`currencies.sources.${source}`);

  const currencyColumns: ColumnsType<CurrencyRecord> = [
    {
      title: t('currencies.columns.code'),
      dataIndex: 'code',
      key: 'code',
      width: 95,
      render: (value: string) => (
        <Typography.Text strong className="currency-code">
          {value}
        </Typography.Text>
      ),
    },
    {
      title: t('currencies.columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('currencies.columns.base'),
      dataIndex: 'isBase',
      key: 'isBase',
      width: 130,
      render: (value: boolean) =>
        value ? <Tag color="gold">{t('currencies.status.base')}</Tag> : t('common.no'),
    },
    {
      title: t('currencies.columns.active'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {t(value ? 'common.yes' : 'common.no')}
        </Tag>
      ),
    },
    {
      title: t('currencies.columns.actions'),
      key: 'actions',
      width: 130,
      render: (_, currency) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            openEdit(currency);
          }}
        >
          {t('currencies.actions.edit')}
        </Button>
      ),
    },
  ];

  const rateColumns: ColumnsType<ExchangeRateRecord> = [
    {
      title: t('currencies.rates.date'),
      dataIndex: 'rateDate',
      key: 'rateDate',
      width: 150,
      render: formatDate,
    },
    {
      title: t('currencies.rates.rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 180,
      render: (value: string) => (
        <Typography.Text className="exchange-rate-value">
          {Number(value).toLocaleString('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })}
        </Typography.Text>
      ),
    },
    {
      title: t('currencies.rates.source'),
      dataIndex: 'source',
      key: 'source',
      render: (value: RateSource) => (
        <Tag color={value === 'MANUAL' ? 'purple' : 'blue'}>
          {sourceLabel(value)}
        </Tag>
      ),
    },
  ];

  return (
    <div className="currencies-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('currencies.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('currencies.subtitle')}
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<SyncOutlined spin={fetching} />}
            loading={fetching}
            onClick={() => void fetchToday()}
          >
            {t('currencies.actions.fetchToday')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateOpen(true);
            }}
          >
            {t('currencies.actions.add')}
          </Button>
        </Space>
      </div>

      <Card className="currencies-list-card">
        <Table
          rowKey="code"
          columns={currencyColumns}
          dataSource={currencies}
          loading={loading}
          pagination={false}
          scroll={{ x: 720 }}
          rowClassName={(currency) =>
            `${currency.isActive ? '' : 'inactive-row'}${
              currency.code === selectedCode ? ' selected-row' : ''
            }`
          }
          onRow={(currency) => ({
            onClick: () => setSelectedCode(currency.code),
          })}
          locale={{ emptyText: t('currencies.empty') }}
        />
      </Card>

      {selected && (
        <Card
          title={t('currencies.rates.title', {
            code: selected.code,
            name: selected.name,
          })}
          extra={
            !selected.isBase && (
              <Button
                type="primary"
                onClick={() => {
                  manualForm.resetFields();
                  manualForm.setFieldsValue({ rateDate: dayjs() });
                  setManualOpen(true);
                }}
              >
                {t('currencies.actions.manualRate')}
              </Button>
            )
          }
        >
          {selected.isBase ? (
            <Alert
              type="info"
              showIcon
              message={t('currencies.rates.baseTitle')}
              description={t('currencies.rates.baseDescription')}
            />
          ) : (
            <Table
              rowKey={(rate) => `${rate.currencyCode}-${rate.rateDate}`}
              size="small"
              columns={rateColumns}
              dataSource={rates}
              loading={ratesLoading}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              locale={{ emptyText: t('currencies.rates.empty') }}
            />
          )}
        </Card>
      )}

      <Modal
        open={createOpen}
        title={t('currencies.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => createForm.submit()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Form<CurrencyFormValues>
          form={createForm}
          layout="vertical"
          onFinish={createCurrency}
          requiredMark={false}
        >
          <Form.Item
            name="code"
            label={t('currencies.form.code')}
            normalize={(value: string) => value?.toUpperCase()}
            rules={[
              { required: true, message: t('currencies.validation.code') },
              {
                pattern: /^[A-Z]{3}$/,
                message: t('currencies.validation.codeFormat'),
              },
            ]}
          >
            <Input maxLength={3} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('currencies.form.name')}
            rules={[
              { required: true, message: t('currencies.validation.name') },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={t('currencies.form.editTitle', { code: editing?.code })}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => editForm.submit()}
        onCancel={() => setEditing(undefined)}
        destroyOnHidden
      >
        <Form<CurrencyFormValues>
          form={editForm}
          layout="vertical"
          onFinish={updateCurrency}
          requiredMark={false}
        >
          <Form.Item name="code" label={t('currencies.form.code')}>
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('currencies.form.name')}
            rules={[
              { required: true, message: t('currencies.validation.name') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="isActive" valuePropName="checked">
            <Checkbox disabled={editing?.isBase}>
              {t('currencies.form.active')}
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={manualOpen}
        title={t('currencies.form.manualTitle', { code: selected?.code })}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => manualForm.submit()}
        onCancel={() => setManualOpen(false)}
        destroyOnHidden
      >
        <Form<ManualRateFormValues>
          form={manualForm}
          layout="vertical"
          onFinish={setManualRate}
          requiredMark={false}
        >
          <Form.Item
            name="rateDate"
            label={t('currencies.form.rateDate')}
            rules={[
              { required: true, message: t('currencies.validation.rateDate') },
            ]}
          >
            <DatePicker className="full-width" />
          </Form.Item>
          <Form.Item
            name="rate"
            label={t('currencies.form.rate')}
            rules={[
              { required: true, message: t('currencies.validation.rate') },
              {
                type: 'number',
                min: 0.000001,
                message: t('currencies.validation.ratePositive'),
              },
            ]}
          >
            <InputNumber
              min={0.000001}
              precision={6}
              className="full-width"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
